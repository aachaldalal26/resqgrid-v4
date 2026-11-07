"""
ResQGrid AI service (Flask).

Endpoints
  GET  /health            -> service + model status
  POST /predict           -> hazard scores, overall score, category, top factors, reason
  POST /anomaly           -> sudden-spike detection (rolling z-score + IsolationForest)
  POST /classify-report   -> classify a citizen photo (CLIP zero-shot; colour heuristic fallback)

Run:  python app.py      (listens on http://127.0.0.1:5000)
"""
import base64
import io
import json
import os
import threading

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request

from risk_formulas import BASELINE, FEATURES, HAZARDS, categorize, factor_label, overall_score

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, "models")

app = Flask(__name__)


@app.after_request
def add_cors(resp):
    # Allow the Next.js app (or a browser) to call this service directly.
    resp.headers["Access-Control-Allow-Origin"] = os.environ.get("CORS_ORIGIN", "*")
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return resp


# --------------------------------------------------------------------------- models
def load_models():
    """Load trained models; retrain automatically if missing or incompatible."""
    try:
        risk = joblib.load(os.path.join(MODELS, "risk_model.joblib"))
        anom = joblib.load(os.path.join(MODELS, "anomaly_model.joblib"))
        return risk, anom
    except Exception as exc:  # missing file or different scikit-learn version
        print(f"[ml] Could not load models ({exc}); training now...")
        from train import train
        train()
        return (joblib.load(os.path.join(MODELS, "risk_model.joblib")),
                joblib.load(os.path.join(MODELS, "anomaly_model.joblib")))


RISK, ANOM = load_models()
try:
    with open(os.path.join(MODELS, "metrics.json")) as f:
        METRICS = json.load(f)
except Exception:
    METRICS = {}


def predict_matrix(df):
    """Predict all hazards for a DataFrame of FEATURES. Returns dict hazard->np.array."""
    return {h: np.clip(RISK["models"][h].predict(df[FEATURES]), 0, 100) for h in HAZARDS}


# --------------------------------------------------------------------------- CLIP
_clip_lock = threading.Lock()
_clip_pipe = None
_clip_error = None
CLIP_LABELS = {
    "a photo of a flooded street or waterlogged area": "flood",
    "a photo of a fire or thick smoke": "fire",
    "a photo of a landslide, mudslide or fallen rocks on a road": "landslide",
    "a photo of storm damage with fallen trees or broken structures": "storm",
    "a photo of a normal street on a clear day": "normal",
}


def get_clip():
    """Lazy-load the Hugging Face CLIP pipeline (only if transformers + torch are installed)."""
    global _clip_pipe, _clip_error
    if _clip_pipe is not None or _clip_error is not None:
        return _clip_pipe
    with _clip_lock:
        if _clip_pipe is None and _clip_error is None:
            if os.environ.get("DISABLE_CLIP") == "1":
                _clip_error = "disabled by DISABLE_CLIP=1"
                return None
            try:
                from transformers import pipeline
                _clip_pipe = pipeline("zero-shot-image-classification",
                                      model=os.environ.get("CLIP_MODEL", "openai/clip-vit-base-patch32"))
                print("[ml] CLIP model loaded")
            except Exception as exc:
                _clip_error = str(exc)
                print(f"[ml] CLIP unavailable, using colour heuristic: {exc}")
    return _clip_pipe


def heuristic_classify(img):
    """Very rough colour-based fallback when CLIP is not installed. Low confidence on purpose."""
    small = img.convert("RGB").resize((64, 64))
    hsv = np.asarray(small.convert("HSV")).reshape(-1, 3) / 255.0
    h, s, v = hsv[:, 0] * 360, hsv[:, 1], hsv[:, 2]
    fire = np.mean(((h < 40) | (h > 340)) & (s > 0.55) & (v > 0.55))
    muddy = np.mean((h >= 20) & (h <= 60) & (s > 0.15) & (s < 0.6) & (v > 0.25) & (v < 0.75))
    grey_water = np.mean((s < 0.18) & (v > 0.3) & (v < 0.8))
    brown = np.mean((h >= 15) & (h <= 45) & (s > 0.3) & (v < 0.6))
    scores = {
        "fire": fire * 2.0,
        "flood": muddy * 0.9 + grey_water * 0.6,
        "landslide": brown * 1.2,
        "storm": grey_water * 0.4,
        "normal": 0.25,
    }
    label = max(scores, key=scores.get)
    return label, float(round(min(0.45, scores[label]), 3))


# --------------------------------------------------------------------------- routes
@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "model": "HistGradientBoosting x4 + IsolationForest",
        "metrics": METRICS,
        "clip": "loaded" if _clip_pipe is not None else ("unavailable: " + _clip_error if _clip_error else "not loaded yet"),
    })


@app.post("/predict")
def predict():
    """Body: {"zones": [{"id": "...", "river": "Mutha", <FEATURES>, "verifiedReports": 0, "officialAlert": 0}]}"""
    body = request.get_json(force=True, silent=True) or {}
    zones = body.get("zones") or []
    if not zones:
        return jsonify({"error": "zones[] required"}), 400
    try:
        base = pd.DataFrame([{f: float(z.get(f, BASELINE[f])) for f in FEATURES} for z in zones])
    except (TypeError, ValueError) as exc:
        return jsonify({"error": f"bad input: {exc}"}), 400

    # Rows: original + one perturbed copy per feature (feature reset to calm baseline)
    blocks = [base]
    for f in FEATURES:
        p = base.copy()
        p[f] = BASELINE[f]
        blocks.append(p)
    preds = predict_matrix(pd.concat(blocks, ignore_index=True))
    n = len(base)

    results = []
    for i, z in enumerate(zones):
        scores = {h: round(float(preds[h][i]), 1) for h in HAZARDS}
        primary = max(HAZARDS, key=lambda h: scores[h])
        verified = int(z.get("verifiedReports", 0) or 0)
        official = int(z.get("officialAlert", 0) or 0)
        sensor = int(z.get("sensorAlarm", 0) or 0)
        overall = overall_score(scores, verified, official, sensor)
        x = base.iloc[i].to_dict()

        factors = []
        for j, f in enumerate(FEATURES):
            impact = scores[primary] - float(preds[primary][n * (j + 1) + i])
            if impact >= 2:
                factors.append({"feature": f, "label": factor_label(f, x, z.get("river")), "impact": round(impact, 1)})
        if verified:
            factors.append({"feature": "verifiedReports", "label": f"{verified} verified citizen report(s)", "impact": float(min(15, 5 * verified))})
        if sensor:
            factors.append({"feature": "sensorAlarm", "label": f"IoT river sensor at {'danger' if sensor == 2 else 'warning'} level", "impact": float(8 * sensor)})
        if official:
            factors.append({"feature": "officialAlert", "label": f"Official advisory level {official}", "impact": float(2 * official)})
        factors = sorted(factors, key=lambda r: -r["impact"])[:4]
        reason = " + ".join(fct["label"] for fct in factors) if factors else \
            "Conditions are normal - no significant hazard drivers right now"

        results.append({"id": z.get("id"), "scores": scores, "overall": overall,
                        "category": categorize(overall), "primaryHazard": primary,
                        "factors": factors, "reason": reason})
    return jsonify({"results": results, "model": "ml"})


@app.post("/anomaly")
def anomaly():
    """Body: {"series": {"zoneId": [24 hourly rain values]}, "features": {"zoneId": {...}}}"""
    body = request.get_json(force=True, silent=True) or {}
    series = body.get("series") or {}
    feats = body.get("features") or {}
    out = {}

    iso_flags = {}
    if feats:
        ids = list(feats.keys())
        mat = pd.DataFrame([{k: float(feats[i].get(k, 0)) for k in ANOM["features"]} for i in ids])
        flags = ANOM["model"].predict(mat)
        iso_flags = {i: bool(flg == -1) for i, flg in zip(ids, flags)}

    for zid in set(series) | set(feats):
        s = np.asarray(series.get(zid) or [0.0] * 24, dtype=float)
        recent, prior = s[-3:], s[:-3]
        mean, std = float(prior.mean()) if prior.size else 0.0, max(0.5, float(prior.std()) if prior.size else 0.5)
        r = float(recent.mean()) if recent.size else 0.0
        z = (r - mean) / std
        note = None
        if r >= 8 and z >= 3:
            note = f"Sudden rainfall spike: {r:.0f} mm/hr vs {mean:.1f} mm/hr normal (z={z:.1f})"
        elif float((feats.get(zid) or {}).get("dischargeRatio", 1)) >= 2.5:
            note = f"River discharge surging to {float(feats[zid]['dischargeRatio']):.1f}x normal"
        elif iso_flags.get(zid) and r >= 4:
            note = "Unusual combination of rain, river and wind readings (IsolationForest)"
        out[zid] = {"anomaly": note is not None, "note": note, "z": round(z, 2), "isolationForest": iso_flags.get(zid, False)}
    return jsonify({"results": out})


@app.post("/classify-report")
def classify_report():
    """Body: {"image_base64": "..."}  -> {"label", "confidence", "method", "all"}"""
    from PIL import Image

    body = request.get_json(force=True, silent=True) or {}
    b64 = body.get("image_base64")
    if not b64:
        return jsonify({"error": "image_base64 required"}), 400
    try:
        if "," in b64[:100]:
            b64 = b64.split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    except Exception as exc:
        return jsonify({"error": f"invalid image: {exc}"}), 400

    pipe = get_clip()
    if pipe is not None:
        res = pipe(img, candidate_labels=list(CLIP_LABELS.keys()))
        all_scores = {CLIP_LABELS[r["label"]]: round(float(r["score"]), 4) for r in res}
        best = max(all_scores, key=all_scores.get)
        return jsonify({"label": best, "confidence": all_scores[best], "method": "clip", "all": all_scores})

    label, conf = heuristic_classify(img)
    return jsonify({"label": label, "confidence": conf, "method": "colour-heuristic", "all": {}})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)

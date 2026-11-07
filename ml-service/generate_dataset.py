"""
Generate a synthetic but realistic training dataset for the ResQGrid risk model.

Why synthetic?  Labelled, city-level disaster-risk data for India is not
publicly available.  We therefore sample realistic weather/terrain conditions for
six "regimes" (dry day, normal monsoon, extreme monsoon, heatwave, storm, and
"upstream" = river rising from dam releases / upstream rain while it is dry locally), compute
hazard scores with expert formulas (risk_formulas.py) and add noise so the model
has to learn the relationships rather than copy them.

Replace data/synthetic_risk.csv with real labelled history (IMD / CWC / NDMA /
state disaster records) and re-run train.py to get a real-world model.

Usage:  python generate_dataset.py --rows 32000
"""
import argparse
import os

import numpy as np
import pandas as pd

from risk_formulas import FEATURES, HAZARDS, hazard_scores


def generate(n, seed=42):
    rng = np.random.default_rng(seed)
    regime = rng.choice(["dry", "monsoon", "extreme", "heat", "storm", "upstream"],
                        p=[0.32, 0.28, 0.12, 0.12, 0.10, 0.06], size=n)

    def by_regime(spec):
        out = np.zeros(n)
        for name, fn in spec.items():
            mask = regime == name
            out[mask] = fn(mask.sum())
        return out

    g = rng.gamma
    df = pd.DataFrame({
        "rain24hPast": by_regime({
            "dry": lambda k: g(0.3, 2, k), "monsoon": lambda k: g(2.0, 15, k),
            "extreme": lambda k: g(4.0, 30, k), "heat": lambda k: g(0.2, 1, k),
            "storm": lambda k: g(2.0, 10, k), "upstream": lambda k: g(0.5, 4, k)}),
        "rain24hForecast": by_regime({
            "dry": lambda k: g(0.3, 2, k), "monsoon": lambda k: g(2.0, 18, k),
            "extreme": lambda k: g(4.0, 35, k), "heat": lambda k: g(0.2, 1, k),
            "storm": lambda k: g(2.5, 12, k), "upstream": lambda k: g(0.5, 4, k)}),
        "rainMaxHourly": by_regime({
            "dry": lambda k: g(0.3, 1, k), "monsoon": lambda k: g(2.0, 5, k),
            "extreme": lambda k: g(4.0, 10, k), "heat": lambda k: g(0.2, 0.5, k),
            "storm": lambda k: g(3.0, 8, k), "upstream": lambda k: g(0.5, 1, k)}),
        "dischargeRatio": by_regime({
            "dry": lambda k: rng.normal(1.0, 0.15, k), "monsoon": lambda k: 1 + g(1.5, 0.6, k),
            "extreme": lambda k: 1 + g(3.0, 1.0, k), "heat": lambda k: rng.normal(0.8, 0.1, k),
            "storm": lambda k: 1 + g(1.2, 0.5, k), "upstream": lambda k: 1 + g(3.0, 1.0, k)}),
        "tempMax": by_regime({
            "dry": lambda k: rng.normal(31, 3, k), "monsoon": lambda k: rng.normal(28, 2, k),
            "extreme": lambda k: rng.normal(26, 2, k), "heat": lambda k: rng.normal(41, 3, k),
            "storm": lambda k: rng.normal(30, 3, k), "upstream": lambda k: rng.normal(29, 3, k)}),
        "windGustMax": by_regime({
            "dry": lambda k: rng.normal(18, 6, k), "monsoon": lambda k: rng.normal(32, 10, k),
            "extreme": lambda k: rng.normal(45, 15, k), "heat": lambda k: rng.normal(20, 6, k),
            "storm": lambda k: rng.normal(70, 18, k), "upstream": lambda k: rng.normal(20, 6, k)}),
        "elevationRel": rng.uniform(0, 110, n),
        "distRiverKm": rng.uniform(0.1, 4.0, n),
        "slopeDeg": rng.gamma(1.6, 3.5, n),
        "floodProne": (rng.random(n) < 0.35).astype(float),
    })
    df["dischargeRatio"] = df["dischargeRatio"].clip(0.2, 10)
    df["windGustMax"] = df["windGustMax"].clip(0, 160)
    df["slopeDeg"] = df["slopeDeg"].clip(0, 35)

    scores = hazard_scores(df)
    for h in HAZARDS:
        noise = rng.normal(0, 3.0, n)
        df[h] = np.clip(scores[h] + noise, 0, 100).round(2)
    df["regime"] = regime
    return df[FEATURES + HAZARDS + ["regime"]]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=30000)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "data", "synthetic_risk.csv"))
    args = ap.parse_args()
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    data = generate(args.rows)
    data.to_csv(args.out, index=False)
    print(f"Wrote {len(data)} rows to {args.out}")
    print(data[HAZARDS].describe().round(1))

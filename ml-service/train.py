"""
Train the ResQGrid risk models.

  * One GradientBoosting regressor per hazard (flood, landslide, heatwave, storm)
  * One IsolationForest trained on "normal" weather to flag anomalies

Outputs:  models/risk_model.joblib, models/anomaly_model.joblib, models/metrics.json

Usage:  python train.py
"""
import json
import os

import joblib
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, IsolationForest
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

from risk_formulas import FEATURES, HAZARDS

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data", "synthetic_risk.csv")
MODELS = os.path.join(HERE, "models")
ANOMALY_FEATURES = ["rainMaxHourly", "rain24hPast", "dischargeRatio", "windGustMax"]


def train():
    if not os.path.exists(DATA):
        from generate_dataset import generate
        os.makedirs(os.path.dirname(DATA), exist_ok=True)
        generate(30000).to_csv(DATA, index=False)
    df = pd.read_csv(DATA)
    X, Y = df[FEATURES], df[HAZARDS]
    X_tr, X_te, Y_tr, Y_te = train_test_split(X, Y, test_size=0.2, random_state=7)

    models, metrics = {}, {}
    for h in HAZARDS:
        m = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.08,
                                          max_leaf_nodes=31, random_state=7)
        m.fit(X_tr, Y_tr[h])
        pred = m.predict(X_te).clip(0, 100)
        metrics[h] = {"r2": round(r2_score(Y_te[h], pred), 4),
                      "mae": round(mean_absolute_error(Y_te[h], pred), 3)}
        models[h] = m
        print(f"{h:10s}  R2={metrics[h]['r2']:.4f}  MAE={metrics[h]['mae']:.2f}")

    normal = df[df["regime"].isin(["dry", "monsoon"])][ANOMALY_FEATURES]
    iso = IsolationForest(n_estimators=200, contamination=0.02, random_state=7).fit(normal)

    os.makedirs(MODELS, exist_ok=True)
    joblib.dump({"models": models, "features": FEATURES}, os.path.join(MODELS, "risk_model.joblib"), compress=3)
    joblib.dump({"model": iso, "features": ANOMALY_FEATURES}, os.path.join(MODELS, "anomaly_model.joblib"), compress=3)
    with open(os.path.join(MODELS, "metrics.json"), "w") as f:
        json.dump({"rows": len(df), "test_rows": len(X_te), "hazards": metrics}, f, indent=2)
    print("Saved models to", MODELS)
    return metrics


if __name__ == "__main__":
    train()

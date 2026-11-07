# ResQGrid AI service

```bat
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py            # http://127.0.0.1:5000/health
```

Retrain: `python generate_dataset.py --rows 30000` then `python train.py` (prints R² / MAE per hazard).
Real image AI: `pip install -r requirements-ai.txt` (see the main README for the CPU torch command on Windows).

| Endpoint | Body | Returns |
|---|---|---|
| `GET /health` | – | status, model metrics, CLIP status |
| `POST /predict` | `{"zones":[{"id","river",rain24hPast,rain24hForecast,rainMaxHourly,dischargeRatio,tempMax,windGustMax,elevationRel,distRiverKm,slopeDeg,floodProne,verifiedReports,officialAlert}]}` | per zone: `scores`, `overall`, `category`, `primaryHazard`, `factors`, `reason` |
| `POST /anomaly` | `{"series":{"zoneId":[24 hourly rain]}, "features":{"zoneId":{...}}}` | per zone: `anomaly`, `note`, `z`, `isolationForest` |
| `POST /classify-report` | `{"image_base64":"..."}` | `label`, `confidence`, `method` (`clip` or `colour-heuristic`) |

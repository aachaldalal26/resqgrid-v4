"""
Shared risk formulas for ResQGrid.

These formulas define the "ground truth" used to generate the synthetic training
dataset. The web app's rule engine (web/src/lib/risk.ts) uses the SAME formulas,
so if the ML service is offline the app still produces consistent scores.

All hazard scores are in the range 0-100.
"""
import numpy as np

FEATURES = [
    "rain24hPast",      # mm of rain that fell in the last 24 h
    "rain24hForecast",  # mm of rain forecast for the next 24 h
    "rainMaxHourly",    # mm/hr, heaviest single hour (last 6 h + next 24 h)
    "dischargeRatio",   # river discharge now / normal (1.0 = normal)
    "tempMax",          # deg C, max temperature next 24 h
    "windGustMax",      # km/h, max gust next 24 h
    "elevationRel",     # metres above the lowest part of the city (~550 m)
    "distRiverKm",      # km to the nearest river
    "slopeDeg",         # average terrain slope in degrees
    "floodProne",       # 1 if historically flood-prone, else 0
]
HAZARDS = ["flood", "landslide", "heatwave", "storm"]

# "Calm" baseline used to explain predictions: we reset one feature at a time
# to this value and measure how much the risk drops.
BASELINE = {
    "rain24hPast": 0.0, "rain24hForecast": 0.0, "rainMaxHourly": 0.0,
    "dischargeRatio": 1.0, "tempMax": 30.0, "windGustMax": 15.0,
    "elevationRel": 80.0, "distRiverKm": 3.0, "slopeDeg": 0.0, "floodProne": 0.0,
}


def _clip(v, lo=0.0, hi=1.0):
    return np.clip(v, lo, hi)


def hazard_scores(df):
    """Vectorised hazard formulas. df: pandas DataFrame or dict of numpy arrays."""
    rain_term = _clip((0.5 * df["rain24hPast"] + 0.8 * df["rain24hForecast"]) / 120)
    intensity = _clip(df["rainMaxHourly"] / 40)
    river = _clip((df["dischargeRatio"] - 1) / 3)
    low_elev = _clip(1 - df["elevationRel"] / 80)
    near = _clip(1 - df["distRiverKm"] / 3)
    wet = np.maximum(rain_term, river)

    flood = 100 * (0.35 * rain_term + 0.15 * intensity + 0.2 * river
                   + 0.1 * low_elev * wet + 0.1 * near * wet + 0.1 * df["floodProne"] * wet)
    slope_f = _clip(df["slopeDeg"] / 15)
    landslide = 100 * slope_f * (0.65 * rain_term + 0.35 * intensity)
    heatwave = 100 * _clip((df["tempMax"] - 34) / 10)
    storm = 100 * (0.7 * _clip((df["windGustMax"] - 30) / 60) + 0.3 * intensity)
    return {"flood": flood, "landslide": landslide, "heatwave": heatwave, "storm": storm}


def overall_score(scores, verified_reports=0, official_alert=0, sensor_alarm=0):
    """scores: dict hazard->float. Highest hazard + a bit of the second + boosts
    (verified citizen reports, official advisory level, IoT sensor alarm level)."""
    vals = sorted((float(scores[h]) for h in HAZARDS), reverse=True)
    total = vals[0] + 0.1 * vals[1] + min(15, 5 * verified_reports) + 2 * official_alert + 8 * sensor_alarm
    return int(round(max(0, min(100, total))))


def categorize(score):
    if score >= 75:
        return "Critical"
    if score >= 55:
        return "High"
    if score >= 30:
        return "Moderate"
    return "Low"


def factor_label(key, x, river=None):
    """Plain-language label for a feature, e.g. 'Heavy rain forecast (82 mm next 24h)'."""
    if key == "rain24hForecast":
        return f"Heavy rain forecast ({x['rain24hForecast']:.0f} mm next 24h)"
    if key == "rain24hPast":
        return f"Rain already fallen ({x['rain24hPast']:.0f} mm last 24h)"
    if key == "rainMaxHourly":
        return f"Intense downpours ({x['rainMaxHourly']:.0f} mm/hr)"
    if key == "dischargeRatio":
        return f"River discharge {x['dischargeRatio']:.1f}x normal"
    if key == "tempMax":
        return f"Extreme heat ({x['tempMax']:.0f} deg C)"
    if key == "windGustMax":
        return f"Strong wind gusts ({x['windGustMax']:.0f} km/h)"
    if key == "elevationRel":
        return "Low-lying terrain"
    if key == "distRiverKm":
        return f"Near {river} river ({x['distRiverKm']:.1f} km)" if river else f"Close to a river ({x['distRiverKm']:.1f} km)"
    if key == "slopeDeg":
        return f"Steep slopes ({x['slopeDeg']:.0f} deg)"
    if key == "floodProne":
        return "Historically flood-prone area"
    return key

/**
 * Rule-based risk engine.
 * Mirrors ml-service/risk_formulas.py exactly, so the app keeps working (with the
 * same scale) when the Python AI service is offline.
 */
import type { Category, Factor, Hazard, HazardScores, ZoneInputs, ZoneRisk } from './types';

export const HAZARDS: Hazard[] = ['flood', 'landslide', 'heatwave', 'storm'];
export const CATEGORY_RANK: Record<Category, number> = { Low: 0, Moderate: 1, High: 2, Critical: 3 };
export const CATEGORY_COLOR: Record<Category, string> = {
  Low: '#16a34a',
  Moderate: '#eab308',
  High: '#f97316',
  Critical: '#dc2626',
};

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

export function hazardScores(x: ZoneInputs): HazardScores {
  const rainTerm = clamp((0.5 * x.rain24hPast + 0.8 * x.rain24hForecast) / 120);
  const intensity = clamp(x.rainMaxHourly / 40);
  const river = clamp((x.dischargeRatio - 1) / 3);
  const lowElev = clamp(1 - x.elevationRel / 80);
  const near = clamp(1 - x.distRiverKm / 3);
  const wet = Math.max(rainTerm, river);
  const flood =
    100 *
    (0.35 * rainTerm + 0.15 * intensity + 0.2 * river + 0.1 * lowElev * wet + 0.1 * near * wet + 0.1 * x.floodProne * wet);
  const slopeF = clamp(x.slopeDeg / 15);
  const landslide = 100 * slopeF * (0.65 * rainTerm + 0.35 * intensity);
  const heatwave = 100 * clamp((x.tempMax - 34) / 10);
  const storm = 100 * (0.7 * clamp((x.windGustMax - 30) / 60) + 0.3 * intensity);
  return { flood: round1(flood), landslide: round1(landslide), heatwave: round1(heatwave), storm: round1(storm) };
}

export function overallScore(s: HazardScores, verified: number, official: number, sensorAlarm = 0) {
  const v = HAZARDS.map((h) => s[h]).sort((a, b) => b - a);
  return Math.round(clamp(v[0] + 0.1 * v[1] + Math.min(15, 5 * verified) + 2 * official + 8 * sensorAlarm, 0, 100));
}

export function categorize(score: number): Category {
  if (score >= 75) return 'Critical';
  if (score >= 55) return 'High';
  if (score >= 30) return 'Moderate';
  return 'Low';
}

/** Smooth green→red colour for a 0-100 score (used in heat strips). */
export function scoreColor(score: number, alpha = 1) {
  const hue = Math.max(0, 135 - score * 1.35);
  return `hsla(${hue}, 85%, ${score > 70 ? 50 : 45}%, ${alpha})`;
}

export const BASELINE: Partial<Record<keyof ZoneInputs, number>> = {
  rain24hPast: 0,
  rain24hForecast: 0,
  rainMaxHourly: 0,
  dischargeRatio: 1,
  tempMax: 30,
  windGustMax: 15,
  elevationRel: 80,
  distRiverKm: 3,
  slopeDeg: 0,
  floodProne: 0,
};

export function factorLabel(key: string, x: ZoneInputs, river?: string): string {
  switch (key) {
    case 'rain24hForecast': return `Heavy rain forecast (${x.rain24hForecast.toFixed(0)} mm next 24h)`;
    case 'rain24hPast': return `Rain already fallen (${x.rain24hPast.toFixed(0)} mm last 24h)`;
    case 'rainMaxHourly': return `Intense downpours (${x.rainMaxHourly.toFixed(0)} mm/hr)`;
    case 'dischargeRatio': return `River discharge ${x.dischargeRatio.toFixed(1)}x normal`;
    case 'tempMax': return `Extreme heat (${x.tempMax.toFixed(0)} deg C)`;
    case 'windGustMax': return `Strong wind gusts (${x.windGustMax.toFixed(0)} km/h)`;
    case 'elevationRel': return 'Low-lying terrain';
    case 'distRiverKm': return river ? `Near ${river} river (${x.distRiverKm.toFixed(1)} km)` : `Close to a river (${x.distRiverKm.toFixed(1)} km)`;
    case 'slopeDeg': return `Steep slopes (${x.slopeDeg.toFixed(0)} deg)`;
    case 'floodProne': return 'Historically flood-prone area';
    default: return key;
  }
}

/** Local explanation: reset one feature at a time to "calm" and measure the drop. */
export function explain(x: ZoneInputs, hazard: Hazard, river?: string): Factor[] {
  const keys = Object.keys(BASELINE) as (keyof ZoneInputs)[];
  const base = hazardScores(x)[hazard];
  return keys
    .map((k) => {
      const pert = hazardScores({ ...x, [k]: BASELINE[k] as number })[hazard];
      return { feature: k, label: factorLabel(k, x, river), impact: round1(base - pert) };
    })
    .filter((f) => f.impact >= 2);
}

export function rulesRisk(x: ZoneInputs, river?: string): Omit<ZoneRisk, 'anomaly' | 'anomalyNote'> {
  const scores = hazardScores(x);
  const primaryHazard = HAZARDS.reduce((a, b) => (scores[b] > scores[a] ? b : a));
  const overall = overallScore(scores, x.verifiedReports, x.officialAlert, x.sensorAlarm ?? 0);
  const factors = explain(x, primaryHazard, river);
  if (x.verifiedReports > 0)
    factors.push({ feature: 'verifiedReports', label: `${x.verifiedReports} verified citizen report(s)`, impact: Math.min(15, 5 * x.verifiedReports) });
  if ((x.sensorAlarm ?? 0) > 0)
    factors.push({ feature: 'sensorAlarm', label: `IoT river sensor at ${x.sensorAlarm === 2 ? 'danger' : 'warning'} level`, impact: 8 * (x.sensorAlarm ?? 0) });
  if (x.officialAlert > 0)
    factors.push({ feature: 'officialAlert', label: `Official advisory level ${x.officialAlert}`, impact: 2 * x.officialAlert });
  const top = factors.sort((a, b) => b.impact - a.impact).slice(0, 4);
  return {
    scores,
    overall,
    category: categorize(overall),
    primaryHazard,
    factors: top,
    reason: top.length ? top.map((f) => f.label).join(' + ') : 'Conditions are normal - no significant hazard drivers right now',
    source: 'rules',
  };
}

/** Rolling z-score spike detector (fallback when the AI service is offline). */
export function zScoreAnomaly(series: number[], dischargeRatio: number): { anomaly: boolean; note: string | null } {
  const recent = series.slice(-3);
  const prior = series.slice(0, -3);
  const mean = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : 0;
  const std = Math.max(0.5, Math.sqrt(prior.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, prior.length)));
  const r = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const z = (r - mean) / std;
  if (r >= 8 && z >= 3)
    return { anomaly: true, note: `Sudden rainfall spike: ${r.toFixed(0)} mm/hr vs ${mean.toFixed(1)} mm/hr normal (z=${z.toFixed(1)})` };
  if (dischargeRatio >= 2.5) return { anomaly: true, note: `River discharge surging to ${dischargeRatio.toFixed(1)}x normal` };
  return { anomaly: false, note: null };
}

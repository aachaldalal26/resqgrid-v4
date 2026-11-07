/**
 * Risk for ANY place in India (village, town, district HQ, any GPS point).
 * Pulls live Open-Meteo weather + river discharge for that exact point, estimates terrain
 * (relief and slope) from 9 elevation samples around it, then runs the same AI model.
 */
import { ZONES } from '@/data/zones';
import { getStore } from './store';
import { getSim } from './engine';
import { mlPost } from './ml';
import { applyScenario, simIntensity } from './scenarios';
import { getJson, istHourKey, median } from './weather';
import { haversineKm, hexPolygon, type LatLng } from './geo';
import { rulesRisk, zScoreAnomaly } from './risk';
import type { Category, Factor, Hazard, HazardScores, Resource, ZoneInputs, ZoneRisk, ZoneState } from './types';

export interface PlaceRisk extends ZoneState {
  kind: 'place';
  district?: string;
  nearestCity: { id: string; name: string; km: number } | null;
  nearby: (Resource & { km: number })[];
  delayed: boolean;
}

interface PointWeather {
  rain24hPast: number;
  rain24hForecast: number;
  rainMaxHourly: number;
  tempMax: number;
  windGustMax: number;
  dischargeRatio: number;
  medianFlow: number;
  elevations: number[]; // centre first, then 8 neighbours
  ring: LatLng[];
  hourlyRain: number[];
  hourlyTemp: number[];
  times: string[];
}

const TTL = 10 * 60 * 1000;
const cache = new Map<string, { at: number; w: PointWeather }>();
const r1 = (v: number) => Math.round(v * 10) / 10;
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
const max = (a: number[]) => (a.length ? Math.max(...a) : 0);

/* eslint-disable @typescript-eslint/no-explicit-any */
async function pointWeather(lat: number, lng: number): Promise<{ w: PointWeather; delayed: boolean }> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return { w: hit.w, delayed: false };

  const d = 0.015; // ~1.6 km
  const ring: LatLng[] = [[lat, lng]];
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) ring.push([lat + a * d, lng + b * d]);
  const ll = `latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}`;

  const [fc, fl, el] = await Promise.allSettled([
    getJson(`https://api.open-meteo.com/v1/forecast?${ll}&hourly=precipitation,temperature_2m,wind_gusts_10m&past_days=1&forecast_days=2&timezone=Asia%2FKolkata`),
    getJson(`https://flood-api.open-meteo.com/v1/flood?${ll}&daily=river_discharge&past_days=7&forecast_days=7`),
    getJson(`https://api.open-meteo.com/v1/elevation?latitude=${ring.map((p) => p[0].toFixed(4)).join(',')}&longitude=${ring.map((p) => p[1].toFixed(4)).join(',')}`),
  ]);

  const elevations: number[] = el.status === 'fulfilled' && Array.isArray(el.value.elevation) ? el.value.elevation : [];
  let ratio = 1;
  let medianFlow = 0;
  const dis = fl.status === 'fulfilled' ? (fl.value?.daily?.river_discharge as (number | null)[] | undefined) : undefined;
  if (dis && dis.length >= 10) {
    const past = dis.slice(0, 7).filter((v): v is number => v != null && v > 0);
    const next = dis.slice(7, 10).filter((v): v is number => v != null && v > 0);
    medianFlow = past.length ? median(past) : 0;
    if (past.length && next.length) ratio = max(next) / Math.max(0.01, medianFlow);
  }

  if (fc.status !== 'fulfilled' || !fc.value?.hourly) {
    // Calm fallback so the page still works offline
    const times: string[] = [];
    for (let k = -24; k < 24; k++) times.push(istHourKey(new Date(Date.now() + k * 3600_000)));
    const w: PointWeather = {
      rain24hPast: 0, rain24hForecast: 0, rainMaxHourly: 0, tempMax: 31, windGustMax: 18, dischargeRatio: 1, medianFlow,
      elevations, ring, hourlyRain: new Array(48).fill(0), hourlyTemp: new Array(48).fill(28), times,
    };
    return { w, delayed: true };
  }

  const h = fc.value.hourly;
  const times: string[] = h.time;
  let idx = times.indexOf(istHourKey());
  if (idx < 24) idx = 24;
  if (idx > times.length - 24) idx = times.length - 24;
  const rain = (h.precipitation as (number | null)[]).map((v) => v ?? 0);
  const temp = (h.temperature_2m as (number | null)[]).map((v) => v ?? 0);
  const gust = (h.wind_gusts_10m as (number | null)[]).map((v) => v ?? 0);
  const w: PointWeather = {
    rain24hPast: r1(sum(rain.slice(idx - 24, idx))),
    rain24hForecast: r1(sum(rain.slice(idx, idx + 24))),
    rainMaxHourly: r1(max(rain.slice(idx - 6, idx + 24))),
    tempMax: r1(max(temp.slice(idx, idx + 24))),
    windGustMax: r1(max(gust.slice(idx, idx + 24))),
    dischargeRatio: Math.round(Math.min(10, Math.max(0.2, ratio)) * 100) / 100,
    medianFlow,
    elevations,
    ring,
    hourlyRain: rain.slice(idx - 24, idx + 24),
    hourlyTemp: temp.slice(idx - 24, idx + 24),
    times: times.slice(idx - 24, idx + 24),
  };
  cache.set(key, { at: Date.now(), w });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return { w, delayed: false };
}

/** Terrain from 9 elevation samples: height above the lowest nearby point, and steepest slope. */
function terrain(w: PointWeather) {
  const e = w.elevations;
  if (e.length < 9) return { reliefM: 30, slopeDeg: 3 };
  const c = e[0];
  const reliefM = Math.max(0, Math.min(110, c - Math.min(...e)));
  let slope = 0;
  for (let i = 1; i < 9; i++) {
    const distM = haversineKm(w.ring[0], w.ring[i]) * 1000;
    slope = Math.max(slope, (Math.atan(Math.abs(c - e[i]) / distM) * 180) / Math.PI);
  }
  return { reliefM: Math.round(reliefM), slopeDeg: Math.round(slope * 10) / 10 };
}

interface MLPredict {
  results: { id: string; scores: HazardScores; overall: number; category: Category; primaryHazard: Hazard; factors: Factor[]; reason: string }[];
}

export async function placeRisk(lat: number, lng: number, name: string, state = '', district = ''): Promise<PlaceRisk> {
  const id = `place-${lat.toFixed(3)}-${lng.toFixed(3)}`;
  const [{ w, delayed }, sim, reports, resources] = await Promise.all([
    pointWeather(lat, lng),
    getSim(),
    getStore().listReports(),
    getStore().listResources(),
  ]);
  const { reliefM, slopeDeg } = terrain(w);
  const nearRiver = w.medianFlow > 20 ? 0.8 : w.medianFlow > 2 ? 2 : 4;
  const floodProne = reliefM < 10 && w.medianFlow > 20 ? 1 : 0;

  let x: ZoneInputs = {
    rain24hPast: w.rain24hPast, rain24hForecast: w.rain24hForecast, rainMaxHourly: w.rainMaxHourly, dischargeRatio: w.dischargeRatio,
    tempMax: w.tempMax, windGustMax: w.windGustMax, elevationRel: reliefM, distRiverKm: nearRiver, slopeDeg, floodProne,
    verifiedReports: 0, officialAlert: 0,
  };

  // Nearest monitored city (also decides how strongly a running drill affects this place)
  let nearestCity: PlaceRisk['nearestCity'] = null;
  for (const z of ZONES) {
    const km = haversineKm([lat, lng], [z.lat, z.lng]);
    if (!nearestCity || km < nearestCity.km) nearestCity = { id: z.id, name: z.name, km: Math.round(km) };
  }
  let hourly = w.hourlyRain.slice();
  const t = simIntensity(sim);
  if (sim.active && sim.scenario && t > 0) {
    const levelId = nearestCity && nearestCity.km <= 150 ? nearestCity.id : '__elsewhere__';
    const r = applyScenario(levelId, x, hourly, sim.scenario, t);
    x = { ...r.x, officialAlert: r.official };
    hourly = r.hourly;
  }
  x.verifiedReports = reports.filter(
    (r) => r.status === 'verified' && Date.now() - Date.parse(r.createdAt) < 86_400_000 && haversineKm([lat, lng], [r.lat, r.lng]) <= 5,
  ).length;

  const river = w.medianFlow > 2 ? 'nearby river' : undefined;
  const [pred, anom] = await Promise.all([
    mlPost<MLPredict>('/predict', { zones: [{ id, river: river ?? null, ...x }] }),
    mlPost<{ results: Record<string, { anomaly: boolean; note: string | null }> }>('/anomaly', {
      series: { [id]: hourly.slice(0, 24) }, features: { [id]: x },
    }),
  ]);
  const m = pred?.results[0];
  const base: Omit<ZoneRisk, 'anomaly' | 'anomalyNote'> = m
    ? { scores: m.scores, overall: m.overall, category: m.category, primaryHazard: m.primaryHazard, factors: m.factors, reason: m.reason, source: 'ml' }
    : rulesRisk(x, river);
  // For searched places "flood-prone" is estimated from terrain + river size, so say exactly that
  base.factors = base.factors.map((f) => (f.feature === 'floodProne' ? { ...f, label: 'Low-lying land beside a large river' } : f));
  base.reason = base.factors.length ? base.factors.map((f) => f.label).join(' + ') : base.reason;
  const a = anom?.results[id] ?? zScoreAnomaly(hourly.slice(0, 24), x.dischargeRatio);
  const tempShift = x.tempMax - w.tempMax;

  const nearby = resources
    .map((r) => ({ ...r, km: Math.round(haversineKm([lat, lng], [r.lat, r.lng]) * 10) / 10 }))
    .filter((r) => r.km <= 200)
    .sort((p, q) => p.km - q.km)
    .slice(0, 5);

  return {
    kind: 'place',
    id, name, state: state || 'India', district, lat, lng, river,
    distRiverKm: nearRiver, slopeDeg, floodProne: !!floodProne, reliefM, population: 0,
    polygon: hexPolygon(lat, lng, 3),
    inputs: x,
    risk: { ...base, anomaly: a.anomaly, anomalyNote: a.note },
    forecast: Array.from({ length: 24 }, (_, i) => ({
      time: (w.times[24 + i] ?? '').slice(11, 16),
      rain: r1(hourly[24 + i] ?? 0),
      temp: r1((w.hourlyTemp[24 + i] ?? 0) + tempShift),
    })),
    nearestCity,
    nearby,
    delayed,
  };
}

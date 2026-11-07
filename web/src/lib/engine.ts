/**
 * The ResQGrid risk engine: weather + terrain + simulation + citizen reports
 * -> AI prediction (or rule fallback) -> alerts on escalation -> risk history.
 */
import { randomUUID } from 'crypto';
import { ZONES, ZONE_POLYGONS } from '@/data/zones';
import en from '@/i18n/en.json';
import { getStore } from './store';
import { fallbackZoneWeather, getWeather } from './weather';
import { mlPost } from './ml';
import { applyScenario, simIntensity } from './scenarios';
import { computeReach } from './audience';
import { CATEGORY_RANK, rulesRisk, zScoreAnomaly } from './risk';
import type {
  Category, Factor, Hazard, HazardScores, LiveState, ScenarioId, SimState, ZoneInputs, ZoneRisk, ZoneState,
} from './types';

interface MLPredict {
  results: { id: string; scores: HazardScores; overall: number; category: Category; primaryHazard: Hazard; factors: Factor[]; reason: string }[];
}
interface MLAnomaly {
  results: Record<string, { anomaly: boolean; note: string | null }>;
}

const SNAPSHOT_EVERY_MS = 15_000;
const CACHE_MS = 2_500;
let cache: { at: number; state: LiveState } | null = null;
let inflight: Promise<LiveState> | null = null;
let lastSnapshotAt = 0;

const SAFETY = en.safety as Record<string, string[]>;
const round1 = (v: number) => Math.round(v * 10) / 10;

export async function getSim(): Promise<SimState> {
  return (await getStore().getState<SimState>('sim')) ?? { active: false, scenario: null, startedAt: null };
}

export async function setSim(scenario: ScenarioId | null): Promise<SimState> {
  const s: SimState = scenario ? { active: true, scenario, startedAt: Date.now() } : { active: false, scenario: null, startedAt: null };
  await getStore().setState('sim', s);
  cache = null;
  return s;
}

export function invalidateLiveState() {
  cache = null;
}

export async function getLiveState(force = false): Promise<LiveState> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.state;
  if (inflight) return inflight;
  inflight = compute()
    .then((state) => {
      cache = { at: Date.now(), state };
      return state;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function compute(): Promise<LiveState> {
  const store = getStore();
  const [weather, sim, reports, iot] = await Promise.all([
    getWeather(), getSim(), store.listReports(),
    store.getState<Record<string, { zoneId: string; type: string; value: number; at: string }>>('iotDevices'),
  ]);
  const t = simIntensity(sim);
  const now = Date.now();

  // 1. Build model inputs per zone
  const rows = ZONES.map((z) => {
    const w = weather.zones[z.id] ?? fallbackZoneWeather(z);
    let x: ZoneInputs = {
      rain24hPast: w.rain24hPast,
      rain24hForecast: w.rain24hForecast,
      rainMaxHourly: w.rainMaxHourly,
      dischargeRatio: w.dischargeRatio,
      tempMax: w.tempMax,
      windGustMax: w.windGustMax,
      elevationRel: z.reliefM,
      distRiverKm: z.distRiverKm,
      slopeDeg: z.slopeDeg,
      floodProne: z.floodProne ? 1 : 0,
      verifiedReports: 0,
      officialAlert: 0,
    };
    let hourly = w.hourlyRain.slice();
    if (sim.active && sim.scenario && t > 0) {
      const r = applyScenario(z.id, x, hourly, sim.scenario, t);
      x = { ...r.x, officialAlert: r.official };
      hourly = r.hourly;
    }
    // Real IoT river-level sensors (POST /api/sensors) override the river estimate when recent
    for (const d of Object.values(iot ?? {})) {
      if (d.zoneId === z.id && d.type === 'river' && now - Date.parse(d.at) < 30 * 60_000) {
        x.dischargeRatio = Math.max(x.dischargeRatio, 1 + Math.max(0, d.value - 2));
        x.sensorAlarm = Math.max(x.sensorAlarm ?? 0, d.value >= 5 ? 2 : d.value >= 4 ? 1 : 0);
      }
    }
    x.verifiedReports = reports.filter(
      (r) => r.zoneId === z.id && r.status === 'verified' && now - Date.parse(r.createdAt) < 86_400_000,
    ).length;
    return { z, w, x, hourly };
  });

  // 2. AI prediction + anomaly detection (falls back to rules if the service is offline)
  const [pred, anom] = await Promise.all([
    mlPost<MLPredict>('/predict', { zones: rows.map(({ z, x }) => ({ id: z.id, river: z.river ?? null, ...x })) }),
    mlPost<MLAnomaly>('/anomaly', {
      series: Object.fromEntries(rows.map(({ z, hourly }) => [z.id, hourly.slice(0, 24)])),
      features: Object.fromEntries(rows.map(({ z, x }) => [z.id, x])),
    }),
  ]);

  const zones: ZoneState[] = rows.map(({ z, w, x, hourly }) => {
    const m = pred?.results.find((r) => r.id === z.id);
    const base: Omit<ZoneRisk, 'anomaly' | 'anomalyNote'> = m
      ? { scores: m.scores, overall: m.overall, category: m.category, primaryHazard: m.primaryHazard, factors: m.factors, reason: m.reason, source: 'ml' }
      : rulesRisk(x, z.river);
    const a = anom?.results[z.id] ?? zScoreAnomaly(hourly.slice(0, 24), x.dischargeRatio);
    const tempShift = x.tempMax - w.tempMax;
    const forecast = Array.from({ length: 24 }, (_, i) => ({
      time: (w.times[24 + i] ?? '').slice(11, 16),
      rain: round1(hourly[24 + i] ?? 0),
      temp: round1((w.hourlyTemp[24 + i] ?? 0) + tempShift),
    }));
    return { ...z, polygon: ZONE_POLYGONS[z.id], inputs: x, risk: { ...base, anomaly: a.anomaly, anomalyNote: a.note }, forecast };
  });

  // 3. Alerts + history
  await processAlerts(zones).catch((e) => console.error('[alerts]', e));
  await maybeSnapshot(zones).catch((e) => console.error('[snapshots]', e));

  const scores = zones.map((z) => z.risk.overall);
  return {
    zones,
    updatedAt: new Date().toISOString(),
    weather: { source: weather.source, fetchedAt: weather.fetchedAt, delayed: weather.delayed, error: weather.error },
    sim: { ...sim, intensity: t },
    ml: !!pred,
    city: {
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      max: Math.max(...scores),
      highCount: zones.filter((z) => z.risk.category === 'High').length,
      criticalCount: zones.filter((z) => z.risk.category === 'Critical').length,
      peopleAtRisk: zones.filter((z) => CATEGORY_RANK[z.risk.category] >= 2).reduce((s, z) => s + z.population, 0),
      anomalies: zones.filter((z) => z.risk.anomaly).length,
    },
  };
}

/** Create an alert whenever a zone escalates to High or Critical. */
async function processAlerts(zones: ZoneState[]) {
  const store = getStore();
  const last = (await store.getState<Record<string, Category>>('lastCategories')) ?? {};
  const next: Record<string, Category> = {};
  let changed = false;
  for (const z of zones) {
    const prev = last[z.id] ?? 'Low';
    const cur = z.risk.category;
    next[z.id] = cur;
    if (cur !== prev) changed = true;
    if (CATEGORY_RANK[cur] >= 2 && CATEGORY_RANK[cur] > CATEGORY_RANK[prev]) {
      const h = z.risk.primaryHazard;
      await store.addAlert({
        id: randomUUID(),
        zoneId: z.id,
        zoneName: z.name,
        hazard: h,
        category: cur,
        title: `${cur} ${h} risk — ${z.name}`,
        message: `${z.risk.reason}. ${SAFETY[h]?.[0] ?? ''}.`,
        source: 'auto',
        createdAt: new Date().toISOString(),
        audience: 'all',
        reach: await computeReach(z.id, 'all'),
      });
    }
  }
  if (changed || Object.keys(last).length === 0) await store.setState('lastCategories', next);
}

async function maybeSnapshot(zones: ZoneState[]) {
  const now = Date.now();
  if (now - lastSnapshotAt < SNAPSHOT_EVERY_MS) return;
  lastSnapshotAt = now;
  const at = new Date(now).toISOString();
  await getStore().addSnapshots(zones.map((z) => ({ at, zoneId: z.id, overall: z.risk.overall, category: z.risk.category })));
}

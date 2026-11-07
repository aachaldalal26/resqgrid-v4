/**
 * Live environmental data from Open-Meteo (free, no API key):
 *   - Forecast API  : hourly rain, temperature, wind gusts (last 24 h + next 24 h)
 *   - Flood API     : river discharge (GloFAS) -> ratio vs. last week's median
 *   - Elevation API : terrain height per zone
 * Cached for 10 minutes. If the APIs fail we keep the last good data and mark it
 * "delayed"; if we never had data we use a calm fallback so the app still runs.
 */
import { ZONES } from '@/data/zones';
import { getStore } from './store';
import type { WeatherMeta, ZoneDef } from './types';

export interface ZoneWeather {
  rain24hPast: number;
  rain24hForecast: number;
  rainMaxHourly: number;
  tempMax: number;
  windGustMax: number;
  dischargeRatio: number;
  elevation: number;
  hourlyRain: number[]; // 48 values: [-24h .. +24h)
  hourlyTemp: number[];
  times: string[];
}
export interface WeatherBundle extends WeatherMeta {
  zones: Record<string, ZoneWeather>;
}

const TTL_MS = 10 * 60 * 1000;
const RETRY_MS = 60 * 1000;
let mem: WeatherBundle | null = null;
let loadedFromStore = false;
let lastAttempt = 0;

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
const max = (a: number[]) => (a.length ? Math.max(...a) : 0);
const r1 = (v: number) => Math.round(v * 10) / 10;

export function istHourKey(d = new Date()) {
  const ist = new Date(d.getTime() + 330 * 60_000);
  return ist.toISOString().slice(0, 13) + ':00';
}

export async function getJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

export function median(a: number[]) {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function fetchOpenMeteo(): Promise<Record<string, ZoneWeather>> {
  const lat = ZONES.map((z) => z.lat.toFixed(4)).join(',');
  const lng = ZONES.map((z) => z.lng.toFixed(4)).join(',');
  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=precipitation,temperature_2m,wind_gusts_10m&past_days=1&forecast_days=2&timezone=Asia%2FKolkata`;
  const floodUrl = `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lng}&daily=river_discharge&past_days=7&forecast_days=7`;
  const elevUrl = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`;

  const [fc, fl, el] = await Promise.allSettled([getJson(forecastUrl), getJson(floodUrl), getJson(elevUrl)]);
  if (fc.status !== 'fulfilled') throw fc.reason;
  const fcArr: any[] = Array.isArray(fc.value) ? fc.value : [fc.value];
  const flArr: any[] = fl.status === 'fulfilled' ? (Array.isArray(fl.value) ? fl.value : [fl.value]) : [];
  const elev: number[] = el.status === 'fulfilled' ? el.value.elevation ?? [] : [];

  const out: Record<string, ZoneWeather> = {};
  ZONES.forEach((z, i) => {
    const h = fcArr[i]?.hourly;
    if (!h) return;
    const times: string[] = h.time;
    let idx = times.indexOf(istHourKey());
    if (idx < 24) idx = 24;
    if (idx > times.length - 24) idx = times.length - 24;
    const rain = (h.precipitation as (number | null)[]).map((v) => v ?? 0);
    const temp = (h.temperature_2m as (number | null)[]).map((v) => v ?? 0);
    const gust = (h.wind_gusts_10m as (number | null)[]).map((v) => v ?? 0);

    let ratio = 1;
    const d = flArr[i]?.daily?.river_discharge as (number | null)[] | undefined;
    if (d && d.length >= 10) {
      const past = d.slice(0, 7).filter((v): v is number => v != null && v > 0);
      const next = d.slice(7, 10).filter((v): v is number => v != null && v > 0);
      if (past.length && next.length) ratio = max(next) / Math.max(0.01, median(past));
    }

    out[z.id] = {
      rain24hPast: r1(sum(rain.slice(idx - 24, idx))),
      rain24hForecast: r1(sum(rain.slice(idx, idx + 24))),
      rainMaxHourly: r1(max(rain.slice(idx - 6, idx + 24))),
      tempMax: r1(max(temp.slice(idx, idx + 24))),
      windGustMax: r1(max(gust.slice(idx, idx + 24))),
      dischargeRatio: Math.round(Math.min(10, Math.max(0.2, ratio)) * 100) / 100,
      elevation: typeof elev[i] === 'number' ? elev[i] : 0,
      hourlyRain: rain.slice(idx - 24, idx + 24),
      hourlyTemp: temp.slice(idx - 24, idx + 24),
      times: times.slice(idx - 24, idx + 24),
    };
  });
  return out;
}

/** Calm, realistic placeholder used only when live data has never been available. */
export function fallbackZoneWeather(z: ZoneDef): ZoneWeather {
  const now = new Date();
  const times: string[] = [];
  const hourlyTemp: number[] = [];
  for (let k = -24; k < 24; k++) {
    const t = new Date(now.getTime() + k * 3600_000);
    times.push(istHourKey(t));
    const hourIst = (t.getUTCHours() + 5.5) % 24;
    hourlyTemp.push(r1(25 + 6 * Math.sin(((hourIst - 9) / 24) * 2 * Math.PI)));
  }
  return {
    rain24hPast: 0, rain24hForecast: 0, rainMaxHourly: 0, tempMax: max(hourlyTemp.slice(24)), windGustMax: 18,
    dischargeRatio: 1, elevation: 0, hourlyRain: new Array(48).fill(0), hourlyTemp, times,
  };
}

export async function getWeather(force = false): Promise<WeatherBundle> {
  const now = Date.now();
  if (!loadedFromStore) {
    loadedFromStore = true;
    try {
      mem = (await getStore().getState<WeatherBundle>('weather')) ?? mem;
    } catch {
      /* ignore */
    }
  }
  if (!force && mem && mem.source === 'open-meteo' && !mem.delayed && now - mem.fetchedAt < TTL_MS) return mem;
  if (!force && mem && now - lastAttempt < RETRY_MS) return mem;
  lastAttempt = now;
  try {
    const zones = await fetchOpenMeteo();
    mem = { source: 'open-meteo', fetchedAt: now, delayed: false, zones };
    await getStore().setState('weather', mem).catch(() => undefined);
    return mem;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (mem && mem.source === 'open-meteo') {
      mem = { ...mem, delayed: true, error };
      return mem;
    }
    mem = {
      source: 'fallback', fetchedAt: now, delayed: true, error,
      zones: Object.fromEntries(ZONES.map((z) => [z.id, fallbackZoneWeather(z)])),
    };
    return mem;
  }
}

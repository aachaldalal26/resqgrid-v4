/**
 * DEMO / SIMULATION MODE
 * Each scenario gradually (over RAMP_MS) pushes the live inputs of selected zones
 * towards extreme values, so judges can watch the risk rise, alerts fire,
 * the map turn red and safe routes change — without waiting for real weather.
 */
import type { ScenarioId, SimState, ZoneInputs } from './types';

export const RAMP_MS = 45_000;

export const SCENARIOS: { id: ScenarioId; title: string; description: string; emoji: string }[] = [
  {
    id: 'monsoon-flood',
    emoji: '🌊',
    title: 'Monsoon floods – Mumbai, Kerala, Assam & Bihar',
    description: 'Extreme monsoon rain: urban flooding in Mumbai and Kolkata, rivers overflowing in Kerala, Assam and Bihar.',
  },
  {
    id: 'cyclone',
    emoji: '🌀',
    title: 'Cyclone landfall – Odisha & Andhra coast',
    description: 'A severe cyclone crosses the east coast with 150 km/h winds and very heavy rain.',
  },
  {
    id: 'heatwave',
    emoji: '🔥',
    title: 'Severe heatwave – North & Central India',
    description: 'Temperatures climb past 45°C across Delhi, Rajasthan, UP and central India.',
  },
  {
    id: 'ghat-landslide',
    emoji: '⛰️',
    title: 'Landslides – Himalayas & Western Ghats',
    description: 'Cloudbursts over Uttarakhand, Himachal, Sikkim and Wayanad saturate steep slopes.',
  },
];

// How strongly each zone is hit (1 = epicentre). Zones not listed get DEFAULT_LEVEL.
const LEVELS: Record<ScenarioId, Record<string, number>> = {
  'monsoon-flood': {
    mumbai: 1, kochi: 1, guwahati: 1, patna: 1, kolkata: 1,
    surat: 0.32, chennai: 0.32, mangaluru: 0.32, panaji: 0.32, srinagar: 0.32, varanasi: 0.32, lucknow: 0.32, imphal: 0.32, pune: 0.32, wayanad: 0.32,
  },
  cyclone: { puri: 1, bhubaneswar: 1, visakhapatnam: 1, kolkata: 0.6, chennai: 0.45, 'port-blair': 0.6, raipur: 0.25, ranchi: 0.25 },
  heatwave: {
    delhi: 0.85, jaipur: 0.85, jodhpur: 0.85, lucknow: 0.85, varanasi: 0.85, nagpur: 0.85, ahmedabad: 0.85,
    bhopal: 0.85, raipur: 0.85, patna: 0.85, chandigarh: 0.85, amritsar: 0.85,
  },
  'ghat-landslide': {
    wayanad: 1, shimla: 1, gangtok: 1, dehradun: 1,
    guwahati: 0.7, mangaluru: 0.7, imphal: 0.7, srinagar: 0.7, thiruvananthapuram: 0.7, panaji: 0.7, pune: 0.5,
  },
};
const DEFAULT_LEVEL: Record<ScenarioId, number> = { 'monsoon-flood': 0.12, cyclone: 0.04, heatwave: 0.45, 'ghat-landslide': 0.08 };

export function simIntensity(sim: SimState, now = Date.now()): number {
  if (!sim.active || !sim.startedAt) return 0;
  return Math.min(1, Math.max(0, (now - sim.startedAt) / RAMP_MS));
}

export function applyScenario(zoneId: string, x: ZoneInputs, hourly: number[], scenario: ScenarioId, t: number) {
  const lvl = (LEVELS[scenario][zoneId] ?? DEFAULT_LEVEL[scenario]) * t;
  const y: ZoneInputs = { ...x };
  const h = hourly.slice();
  while (h.length < 48) h.push(0);
  const official = t < 0.25 ? 1 : t < 0.7 ? 2 : 3;

  // Add a rising burst over the last 6 hours, and spread extra forecast rain over the next 24 h.
  const addRain = (peakNow: number, forecastAdd: number) => {
    for (let i = 18; i < 24; i++) h[i] += peakNow * (0.4 + (0.6 * (i - 18)) / 5);
    for (let k = 0; k < 24; k++) h[24 + k] += (forecastAdd / 24) * (1.5 - k / 24);
  };

  if (scenario === 'monsoon-flood') {
    y.rain24hPast += 150 * lvl;
    y.rain24hForecast += 170 * lvl;
    y.rainMaxHourly = Math.max(y.rainMaxHourly, 60 * lvl);
    y.dischargeRatio = Math.max(y.dischargeRatio, 1 + 4.5 * lvl);
    y.windGustMax = Math.max(y.windGustMax, 25 + 35 * lvl);
    addRain(60 * lvl, 170 * lvl);
  } else if (scenario === 'heatwave') {
    y.tempMax = y.tempMax + Math.max(0, 46 - y.tempMax) * lvl;
  } else if (scenario === 'cyclone') {
    y.windGustMax = Math.max(y.windGustMax, 40 + 110 * lvl);
    y.rain24hPast += 80 * lvl;
    y.rain24hForecast += 200 * lvl;
    y.rainMaxHourly = Math.max(y.rainMaxHourly, 50 * lvl);
    y.dischargeRatio = Math.max(y.dischargeRatio, 1 + 2 * lvl);
    addRain(45 * lvl, 200 * lvl);
  } else {
    y.rain24hPast += 130 * lvl;
    y.rain24hForecast += 110 * lvl;
    y.rainMaxHourly = Math.max(y.rainMaxHourly, 50 * lvl);
    y.dischargeRatio = Math.max(y.dischargeRatio, 1 + 1.5 * lvl);
    addRain(50 * lvl, 110 * lvl);
  }
  return { x: y, hourly: h, official };
}

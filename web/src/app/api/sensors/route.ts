import { NextRequest, NextResponse } from 'next/server';
import { getLiveState } from '@/lib/engine';
import { getStore } from '@/lib/store';
import { ZONES } from '@/data/zones';
import type { SensorStation } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * IoT sensor grid.
 * - Every city has 3 VIRTUAL stations (rain gauge, river level, temperature) derived from live data,
 *   so the dashboard works before hardware exists.
 * - Real devices (e.g. ESP32 + ultrasonic river sensor) POST readings here; those appear as
 *   "device" stations and a river reading also feeds the risk model (see engine.ts).
 */
type DeviceReading = { deviceId: string; zoneId: string; type: 'rain' | 'river' | 'temp'; value: number; at: string };
const g = globalThis as unknown as { __rqSensorHist?: Map<string, number[]> };
const hist = (g.__rqSensorHist ??= new Map());

const SPEC = {
  rain: { label: 'Rain gauge', unit: 'mm/hr', warning: 15, danger: 35 },
  river: { label: 'River level', unit: 'm', warning: 4, danger: 5 },
  temp: { label: 'Temperature', unit: '°C', warning: 40, danger: 44 },
} as const;

function push(id: string, v: number) {
  const h = hist.get(id) ?? [];
  if (!h.length || h[h.length - 1] !== v) h.push(v);
  hist.set(id, h.slice(-24));
  return hist.get(id)!;
}
const status = (v: number, w: number, d: number): SensorStation['status'] => (v >= d ? 'danger' : v >= w ? 'warning' : 'normal');
const r1 = (v: number) => Math.round(v * 10) / 10;

export async function GET(req: NextRequest) {
  const zoneFilter = req.nextUrl.searchParams.get('zone');
  const state = await getLiveState();
  const devices = (await getStore().getState<Record<string, DeviceReading>>('iotDevices')) ?? {};
  const now = new Date().toISOString();
  const out: SensorStation[] = [];

  for (const z of state.zones) {
    if (zoneFilter && z.id !== zoneFilter) continue;
    const hourlyNow = z.forecast[0]?.rain ?? 0;
    const values = {
      rain: r1(Math.max(hourlyNow, z.inputs.rainMaxHourly * 0.85)),
      river: z.river && !z.river.includes('coast') ? r1(2 + (z.inputs.dischargeRatio - 1) * 1.6) : null,
      temp: r1(z.forecast[0]?.temp ?? z.inputs.tempMax),
    };
    (['rain', 'river', 'temp'] as const).forEach((type) => {
      const v = values[type];
      if (v === null) return;
      const s = SPEC[type];
      const id = `v-${z.id}-${type}`;
      out.push({
        id, zoneId: z.id, zoneName: z.name, type, label: `${s.label} · ${type === 'river' ? z.river : z.name}`,
        unit: s.unit, value: v, warning: s.warning, danger: s.danger, status: status(v, s.warning, s.danger),
        history: push(id, v), source: 'virtual', updatedAt: now,
      });
    });
  }
  for (const d of Object.values(devices)) {
    if (zoneFilter && d.zoneId !== zoneFilter) continue;
    const s = SPEC[d.type];
    const z = ZONES.find((x) => x.id === d.zoneId);
    out.push({
      id: d.deviceId, zoneId: d.zoneId, zoneName: z?.name ?? d.zoneId, type: d.type, label: `${s.label} · device ${d.deviceId}`,
      unit: s.unit, value: d.value, warning: s.warning, danger: s.danger, status: status(d.value, s.warning, s.danger),
      history: hist.get(d.deviceId) ?? [d.value], source: 'device', updatedAt: d.at,
    });
  }
  return NextResponse.json(out);
}

/** IoT device ingestion. Body: {"deviceId":"esp32-01","zoneId":"mumbai","type":"river","value":4.6} */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const type = b.type as DeviceReading['type'];
  const value = Number(b.value);
  if (!b.deviceId || !ZONES.some((z) => z.id === b.zoneId) || !(type in SPEC) || !Number.isFinite(value)) {
    return NextResponse.json({ error: 'Expected {deviceId, zoneId, type: rain|river|temp, value}' }, { status: 400 });
  }
  const id = String(b.deviceId).slice(0, 40);
  const devices = (await getStore().getState<Record<string, DeviceReading>>('iotDevices')) ?? {};
  devices[id] = { deviceId: id, zoneId: b.zoneId, type, value, at: new Date().toISOString() };
  await getStore().setState('iotDevices', devices);
  push(id, value);
  return NextResponse.json({ ok: true, reading: devices[id] }, { status: 201 });
}

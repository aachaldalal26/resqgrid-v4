'use client';
import { Cpu } from 'lucide-react';
import type { SensorStation } from '@/lib/types';

const TONE = { normal: '#34d399', warning: '#f59e0b', danger: '#ef4444' } as const;

function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <span className="text-[10px] text-cc-mute">collecting…</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" className="h-7 w-24" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** IoT sensor grid: virtual stations from live data + any real devices that POST readings. */
export default function SensorGrid({ local, alarms }: { local: SensorStation[]; alarms: SensorStation[] }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {local.length === 0 && <p className="text-xs text-cc-mute">No sensors for this city.</p>}
        {local.map((s) => (
          <div key={s.id} className="rounded-xl border border-white/5 bg-white/[.03] p-3">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="font-mono text-2xl font-bold" style={{ color: TONE[s.status] }}>{s.value}<span className="ml-1 text-xs text-slate-400">{s.unit}</span></p>
              <Spark values={s.history} color={TONE[s.status]} />
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded bg-white/10">
              <div className="h-full" style={{ width: `${Math.min(100, (s.value / (s.danger * 1.2)) * 100)}%`, background: TONE[s.status] }} />
            </div>
            <p className="mt-1 flex justify-between text-[10px] text-cc-mute"><span>warn {s.warning} · danger {s.danger}</span><span>{s.source === 'device' ? '📡 device' : 'virtual'}</span></p>
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <p className="cc-title mb-1.5"><Cpu size={12} className="text-cyan-300" /> Stations above warning · all India ({alarms.length})</p>
        <ul className="h-[calc(100%-22px)] space-y-1 overflow-y-auto pr-1">
          {alarms.length === 0 && <li className="text-[11px] text-cc-mute">All sensor readings normal.</li>}
          {alarms.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-lg bg-white/[.03] px-2.5 py-1.5 text-xs">
              <span className="truncate text-slate-300">{s.zoneName} · {s.label.split(' · ')[0]}</span>
              <span className="font-mono font-bold" style={{ color: TONE[s.status] }}>{s.value} {s.unit}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

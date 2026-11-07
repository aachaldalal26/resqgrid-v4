'use client';
import { useMemo } from 'react';
import { scoreColor } from '@/lib/risk';
import { hhmm } from '@/lib/format';
import type { Snapshot, ZoneState } from '@/lib/types';

/** Risk "seismograph": each row a zone, each column a snapshot in time. */
export default function HeatStrip({ snapshots, zones, onSelect }: { snapshots: Snapshot[]; zones: ZoneState[]; onSelect: (id: string) => void }) {
  const { times, grid } = useMemo(() => {
    const times = [...new Set(snapshots.map((s) => s.at))].sort().slice(-40);
    const grid = new Map<string, Map<string, number>>();
    for (const s of snapshots) {
      if (!grid.has(s.zoneId)) grid.set(s.zoneId, new Map());
      grid.get(s.zoneId)!.set(s.at, s.overall);
    }
    return { times, grid };
  }, [snapshots]);

  if (times.length < 2) return <p className="grid h-full place-items-center text-xs text-cc-mute">Collecting risk history… (a snapshot every 15 s)</p>;
  const ordered = [...zones].sort((a, b) => b.risk.overall - a.risk.overall);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-[3px] overflow-y-auto pr-1">
        {ordered.map((z) => (
          <button key={z.id} onClick={() => onSelect(z.id)} className="group flex w-full items-center gap-2">
            <span className="w-28 shrink-0 truncate text-left text-[11px] text-slate-400 group-hover:text-white">{z.name}</span>
            <span className="flex h-3.5 flex-1 gap-[2px]">
              {times.map((t) => {
                const v = grid.get(z.id)?.get(t);
                return <span key={t} className="flex-1 rounded-[2px]" style={{ background: v === undefined ? '#111a2e' : scoreColor(v, 0.9) }} title={v === undefined ? '' : `${hhmm(t)} · ${v}`} />;
              })}
            </span>
            <span className="w-7 text-right font-mono text-[11px] text-white">{z.risk.overall}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between pl-[120px] pr-9 font-mono text-[10px] text-cc-mute">
        <span>{hhmm(times[0])}</span>
        <span>now</span>
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { Ambulance, Hospital, Tent } from 'lucide-react';
import { haversineKm } from '@/lib/geo';
import type { Resource, ZoneState } from '@/lib/types';

const NEXT: Record<Resource['type'], Resource['status'][]> = {
  shelter: ['available', 'full'],
  hospital: ['available', 'busy', 'full'],
  rescue: ['available', 'deployed'],
};
const TONE: Record<Resource['status'], string> = {
  available: 'bg-emerald-500/15 text-emerald-300',
  busy: 'bg-amber-500/15 text-amber-300',
  full: 'bg-red-500/15 text-red-300',
  deployed: 'bg-violet-500/20 text-violet-200',
};
const ICON = { shelter: Tent, hospital: Hospital, rescue: Ambulance };

/** Shelters, hospitals and rescue teams sorted by distance to the focused zone. Click a status to change it. */
export default function ResourceBoard({ resources, zone, onChanged }: { resources: Resource[]; zone: ZoneState | null; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const cycle = async (r: Resource) => {
    const list = NEXT[r.type];
    const status = list[(list.indexOf(r.status) + 1) % list.length];
    setBusy(r.id);
    await fetch('/api/resources', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.id, status }) });
    setBusy(null);
    onChanged();
  };
  const sorted = [...resources].sort((a, b) =>
    zone ? haversineKm([zone.lat, zone.lng], [a.lat, a.lng]) - haversineKm([zone.lat, zone.lng], [b.lat, b.lng]) : a.type.localeCompare(b.type),
  );

  return (
    <ul className="h-full space-y-1.5 overflow-y-auto pr-1">
      {sorted.map((r) => {
        const I = ICON[r.type];
        const d = zone ? haversineKm([zone.lat, zone.lng], [r.lat, r.lng]) : null;
        return (
          <li key={r.id} className="flex items-center gap-2.5 rounded-lg bg-white/[.03] p-2">
            <I size={15} className="shrink-0 text-cyan-300" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{r.name}</p>
              <p className="text-[10px] text-cc-mute">
                {r.type}
                {r.capacity ? ` · ${r.occupied}/${r.capacity}` : ''}
                {d !== null ? ` · ${d.toFixed(1)} km` : ''}
              </p>
            </div>
            <button disabled={busy === r.id} onClick={() => cycle(r)} className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${TONE[r.status]}`} title="Click to change status">
              {r.status}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

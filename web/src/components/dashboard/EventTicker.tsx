'use client';
import { Camera, Megaphone, Siren } from 'lucide-react';
import { CATEGORY_COLOR } from '@/lib/risk';
import { timeAgo } from '@/lib/format';
import type { Alert, Report } from '@/lib/types';

type Item = { id: string; at: string; kind: 'alert' | 'broadcast' | 'report'; title: string; sub: string; color: string };

/** Unified live feed of auto alerts, broadcasts and citizen reports. */
export default function EventTicker({ alerts, reports }: { alerts: Alert[]; reports: Report[] }) {
  const items: Item[] = [
    ...alerts.map((a) => ({
      id: a.id, at: a.createdAt, kind: (a.source === 'authority' ? 'broadcast' : 'alert') as Item['kind'],
      title: a.title, sub: a.message, color: CATEGORY_COLOR[a.category],
    })),
    ...reports.map((r) => ({
      id: r.id, at: r.createdAt, kind: 'report' as const,
      title: `Citizen report · ${r.hazard} · ${r.zoneName}`,
      sub: `${r.description || 'No description'} — verification ${Math.round(r.verificationScore * 100)}%`,
      color: r.status === 'verified' ? '#ef4444' : r.status === 'pending' ? '#f59e0b' : '#64748b',
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);

  if (!items.length) return <p className="grid h-full place-items-center text-xs text-cc-mute">All quiet. Events will stream here.</p>;
  const Icon = { alert: Siren, broadcast: Megaphone, report: Camera };
  return (
    <ul className="h-full space-y-1.5 overflow-y-auto pr-1">
      {items.map((it) => {
        const I = Icon[it.kind];
        return (
          <li key={it.id} className="feed-in flex gap-2.5 rounded-lg border-l-2 bg-white/[.03] p-2" style={{ borderColor: it.color }}>
            <I size={14} className="mt-0.5 shrink-0" style={{ color: it.color }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{it.title}</p>
              <p className="line-clamp-2 text-[11px] text-slate-400">{it.sub}</p>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-cc-mute">{timeAgo(it.at)}</span>
          </li>
        );
      })}
    </ul>
  );
}

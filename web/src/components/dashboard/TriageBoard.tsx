'use client';
import { useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { timeAgo } from '@/lib/format';
import type { Report } from '@/lib/types';

const COLS: { id: Report['status']; title: string; tone: string }[] = [
  { id: 'pending', title: 'Incoming', tone: 'text-amber-300' },
  { id: 'verified', title: 'Verified', tone: 'text-emerald-300' },
  { id: 'rejected', title: 'Rejected', tone: 'text-slate-400' },
];

/** Kanban-style triage of citizen reports with AI evidence on every card. */
export default function TriageBoard({ reports, onChanged, onFocus }: { reports: Report[]; onChanged: () => void; onFocus: (p: [number, number]) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const setStatus = async (id: string, status: Report['status']) => {
    setBusy(id);
    await fetch(`/api/reports/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
    setBusy(null);
    onChanged();
  };

  return (
    <div className="grid h-full grid-cols-1 gap-3 sm:grid-cols-3">
      {COLS.map((col) => {
        const list = reports.filter((r) => r.status === col.id).slice(0, col.id === 'pending' ? 30 : 10);
        return (
          <div key={col.id} className="flex min-h-0 flex-col rounded-xl bg-black/20 p-2">
            <p className={`mb-2 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-widest ${col.tone}`}>
              {col.title} <span className="rounded bg-white/10 px-1.5 font-mono text-white">{reports.filter((r) => r.status === col.id).length}</span>
            </p>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
              {list.length === 0 && <p className="py-6 text-center text-[11px] text-cc-mute">Empty</p>}
              {list.map((r) => (
                <article key={r.id} className="feed-in rounded-lg border border-white/5 bg-[#101a2e] p-2.5">
                  <div className="flex gap-2">
                    {r.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
                    ) : (
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white/5 text-[10px] text-cc-mute">no photo</span>
                    )}
                    <button className="min-w-0 flex-1 text-left" onClick={() => onFocus([r.lat, r.lng])}>
                      <p className="truncate text-xs font-bold capitalize text-white">{r.hazard} · {r.zoneName}</p>
                      <p className="line-clamp-2 text-[11px] text-slate-400">{r.description || '—'}</p>
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded bg-white/10">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-emerald-400" style={{ width: `${r.verificationScore * 100}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-slate-300">{Math.round(r.verificationScore * 100)}%</span>
                  </div>
                  <p className="mt-1 text-[10px] text-cc-mute">
                    {r.aiLabel ? `AI: ${r.aiLabel} ${Math.round((r.aiConfidence ?? 0) * 100)}% (${r.aiMethod})` : 'AI: no photo'} · {timeAgo(r.createdAt)}
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    {r.status !== 'verified' && (
                      <button disabled={busy === r.id} onClick={() => setStatus(r.id, 'verified')} className="flex flex-1 items-center justify-center gap-1 rounded-md bg-emerald-500/15 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25">
                        <Check size={12} /> Verify
                      </button>
                    )}
                    {r.status !== 'rejected' && (
                      <button disabled={busy === r.id} onClick={() => setStatus(r.id, 'rejected')} className="flex flex-1 items-center justify-center gap-1 rounded-md bg-red-500/15 py-1 text-[11px] font-bold text-red-300 hover:bg-red-500/25">
                        <X size={12} /> Reject
                      </button>
                    )}
                    {r.status !== 'pending' && (
                      <button disabled={busy === r.id} onClick={() => setStatus(r.id, 'pending')} className="flex items-center justify-center rounded-md bg-white/5 px-2 py-1 text-slate-300 hover:bg-white/10" title="Reopen">
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

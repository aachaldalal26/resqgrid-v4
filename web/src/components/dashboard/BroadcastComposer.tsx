'use client';
import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { ZONES } from '@/data/zones';
import type { Category } from '@/lib/types';

const TEMPLATES = [
  { label: 'Evacuate', category: 'Critical' as Category, text: 'Evacuate low-lying areas immediately. Move to the nearest relief shelter shown on the ResQGrid map. Rescue teams are on the way.' },
  { label: 'Shelter open', category: 'High' as Category, text: 'Relief shelters are open with food, water and medical help. Follow the safe route on the ResQGrid map.' },
  { label: 'Avoid area', category: 'High' as Category, text: 'Avoid travel through this area. Roads may be flooded or blocked. Use alternate routes.' },
  { label: 'Close schools', category: 'High' as Category, text: 'All schools and colleges in the area to remain closed tomorrow. Keep students at home and follow official updates.' },
  { label: 'All clear', category: 'Low' as Category, text: 'The situation is under control. You may return home safely. Stay alert for further updates.' },
];

/** Authority broadcast: pick an area, severity and message (or a template), send to everyone in that area. */
export default function BroadcastComposer({ defaultZone, onSent }: { defaultZone: string | null; onSent: () => void }) {
  const [zoneId, setZoneId] = useState<string>(defaultZone ?? '');
  const [category, setCategory] = useState<Category>('High');
  const [audience, setAudience] = useState('all');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    const zone = ZONES.find((z) => z.id === zoneId);
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ zoneId: zoneId || null, category, audience, hazard: 'general', title: `Official notice — ${zone?.name ?? 'All of India'}${audience !== 'all' ? ' (' + audience + ')' : ''}`, message }),
    });
    setBusy(false);
    if (res.ok) {
      const a = await res.json();
      const ch = Object.entries(a.reach?.channels ?? {}).map(([c, n]) => `${c} ${n}`).join(', ');
      setDone(`Sent to ${zone?.name ?? 'all of India'} · ${a.reach?.subscribers ?? 0} subscribers${ch ? ' (' + ch + ')' : ''} + app users`);
      setMessage('');
      onSent();
      setTimeout(() => setDone(null), 4000);
    } else setDone((await res.json()).error ?? 'Failed');
  };

  const field = 'w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-400';
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <select className={field} value={zoneId} onChange={(e) => setZoneId(e.target.value)} aria-label="Target area">
          <option value="">All of India</option>
          {ZONES.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <select className={field} value={category} onChange={(e) => setCategory(e.target.value as Category)} aria-label="Severity">
          {(['Low', 'Moderate', 'High', 'Critical'] as Category[]).map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <select className={field} value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Audience">
        <option value="all">Everyone in the area</option>
        <option value="schools">Schools &amp; colleges only</option>
        <option value="vulnerable">Vulnerable communities (priority)</option>
        <option value="responders">Emergency responders</option>
        <option value="ngos">NGOs &amp; volunteers</option>
        <option value="residents">Residents</option>
      </select>
      <div className="flex flex-wrap gap-1">
        {TEMPLATES.map((t) => (
          <button key={t.label} onClick={() => { setMessage(t.text); setCategory(t.category); }} className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-white/10">
            {t.label}
          </button>
        ))}
      </div>
      <textarea className={`${field} min-h-[70px] flex-1 resize-none`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type the alert residents will receive…" maxLength={600} />
      <button onClick={send} disabled={busy || !message.trim()} className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-orange-500 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-4px_rgba(239,68,68,.7)] disabled:opacity-40">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Broadcast alert
      </button>
      {done && <p className="text-center text-[11px] font-semibold text-emerald-300">{done}</p>}
    </div>
  );
}

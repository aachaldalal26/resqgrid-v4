'use client';
import { Bell, GraduationCap, HandHeart, HeartPulse, Mail, MessageCircle, Smartphone, Truck, Users } from 'lucide-react';
import { timeAgo } from '@/lib/format';
import type { Alert } from '@/lib/types';

export interface SubStats { total: number; byGroup: Record<string, number>; byZone: Record<string, number>; byChannel: Record<string, number> }

const GROUPS = [
  { id: 'residents', label: 'Residents', icon: Users },
  { id: 'schools', label: 'Schools & colleges', icon: GraduationCap },
  { id: 'vulnerable', label: 'Vulnerable', icon: HeartPulse },
  { id: 'responders', label: 'Responders', icon: Truck },
  { id: 'ngos', label: 'NGOs', icon: HandHeart },
];
const CH = [
  { id: 'push', icon: Bell }, { id: 'sms', icon: Smartphone }, { id: 'whatsapp', icon: MessageCircle }, { id: 'email', icon: Mail },
];

/** Who is listening (subscribers by group & channel) and the delivery log of recent alerts. */
export default function AudiencePanel({ stats, alerts }: { stats: SubStats | null; alerts: Alert[] }) {
  const max = Math.max(1, ...GROUPS.map((g) => stats?.byGroup[g.id] ?? 0));
  const log = alerts.filter((a) => a.reach).slice(0, 8);
  return (
    <div className="grid h-full gap-4 sm:grid-cols-2">
      <div>
        <p className="font-mono text-3xl font-bold text-white">{stats?.total ?? 0}<span className="ml-2 text-xs font-sans font-semibold uppercase tracking-wider text-slate-400">subscribers</span></p>
        <ul className="mt-3 space-y-2">
          {GROUPS.map((g) => {
            const n = stats?.byGroup[g.id] ?? 0;
            return (
              <li key={g.id} className="flex items-center gap-2 text-xs">
                <g.icon size={14} className="text-cyan-300" />
                <span className="w-28 text-slate-300">{g.label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded bg-white/10"><span className="block h-full bg-cyan-400" style={{ width: `${(n / max) * 100}%` }} /></span>
                <span className="w-6 text-right font-mono text-white">{n}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex gap-2">
          {CH.map((c) => (
            <span key={c.id} className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-slate-300">
              <c.icon size={12} /> {stats?.byChannel[c.id] ?? 0}
            </span>
          ))}
        </div>
        {(!stats || stats.total === 0) && <p className="mt-3 text-[11px] text-cc-mute">No subscribers yet — sign up on /subscribe to see reach.</p>}
      </div>
      <div className="min-h-0">
        <p className="cc-title mb-2">Delivery log</p>
        <ul className="max-h-[230px] space-y-1.5 overflow-y-auto pr-1">
          {log.length === 0 && <li className="text-[11px] text-cc-mute">Alerts will show their reach here.</li>}
          {log.map((a) => (
            <li key={a.id} className="rounded-lg bg-white/[.03] p-2">
              <p className="truncate text-[11px] font-semibold text-white">{a.title}</p>
              <p className="text-[10px] text-slate-400">
                {a.audience && a.audience !== 'all' ? `${a.audience} · ` : ''}{a.reach!.subscribers} reached
                {Object.entries(a.reach!.channels).map(([c, n]) => ` · ${c} ${n}`).join('')} · {timeAgo(a.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

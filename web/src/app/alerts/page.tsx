'use client';
import { useEffect, useState } from 'react';
import { Bell, BellRing, Landmark, Megaphone, Users } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { usePoll } from '@/hooks/usePoll';
import { CATEGORY_COLOR } from '@/lib/risk';
import { timeAgo } from '@/lib/format';
import { ZONES } from '@/data/zones';
import type { Alert, OfficialAlert, Report } from '@/lib/types';

type Tab = 'live' | 'official' | 'community';
const LEVEL_COLOR: Record<string, string> = { Red: '#dc2626', Orange: '#f97316', Yellow: '#eab308', Advisory: '#2563eb', Normal: '#16a34a' };

export default function AlertsPage() {
  const { t, tips } = useI18n();
  const [tab, setTab] = useState<Tab>('live');
  const [myZone, setMyZone] = useState<string>('all');
  const [perm, setPerm] = useState<string>('default');
  const [group, setGroup] = useState<string>('residents');
  const { data: alerts } = usePoll<Alert[]>('/api/alerts?limit=100', 5000);
  const { data: official } = usePoll<OfficialAlert[]>('/api/official-alerts', 15000);
  const { data: reports } = usePoll<Report[]>('/api/reports', 10000);

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPerm(Notification.permission);
    try {
      setMyZone(localStorage.getItem('rq_zone') || 'all');
      setGroup(localStorage.getItem('rq_group') || 'residents');
    } catch {
      /* ignore */
    }
  }, []);

  const pickZone = (z: string) => {
    setMyZone(z);
    try {
      localStorage.setItem('rq_zone', z);
    } catch {
      /* ignore */
    }
  };
  const enable = async () => {
    if (typeof Notification === 'undefined') return;
    setPerm(await Notification.requestPermission());
  };

  const liveList = (alerts ?? []).filter(
    (a) => (myZone === 'all' || a.zoneId === myZone || a.zoneId === null) && (!a.audience || a.audience === 'all' || a.audience === group || group === 'responders'),
  );
  const commList = (reports ?? []).filter((r) => myZone === 'all' || r.zoneId === myZone);

  const tabs: { id: Tab; label: string; icon: typeof Bell; count?: number }[] = [
    { id: 'live', label: t('alerts.live'), icon: BellRing, count: liveList.length },
    { id: 'official', label: t('alerts.official'), icon: Landmark, count: official?.length },
    { id: 'community', label: t('alerts.community'), icon: Users, count: commList.length },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-brand-900">{t('alerts.title')}</h1>
        <div className="flex items-center gap-2">
          <select className="input !w-auto !py-2" value={myZone} onChange={(e) => pickZone(e.target.value)} aria-label={t('alerts.myZone')}>
            <option value="all">{t('alerts.allZones')}</option>
            {ZONES.map((z) => (
              <option key={z.id} value={z.id}>{t('alerts.myZone')}: {z.name}</option>
            ))}
          </select>
          <button onClick={enable} disabled={perm === 'granted'} className={perm === 'granted' ? 'btn-ghost' : 'btn-primary'}>
            <Bell size={16} /> {perm === 'granted' ? t('alerts.enabled') : t('alerts.enable')}
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-1 rounded-2xl bg-slate-100 p-1">
        {tabs.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold ${tab === x.id ? 'bg-white text-brand-700 shadow' : 'text-slate-600'}`}>
            <x.icon size={16} /> <span className="hidden sm:inline">{x.label}</span>
            {x.count !== undefined && <span className="rounded-full bg-slate-200 px-1.5 text-xs">{x.count}</span>}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {tab === 'live' && (liveList.length === 0 ? <Empty text={t('alerts.none')} /> : liveList.map((a) => (
          <article key={a.id} className="card overflow-hidden">
            <div className="flex">
              <div className="w-1.5 shrink-0" style={{ background: CATEGORY_COLOR[a.category] }} />
              <div className="flex-1 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-bold text-brand-900">
                    {a.source === 'authority' && <Megaphone size={15} className="mr-1 inline text-brand-600" />}
                    {a.source === 'authority' ? a.title : t('alertTitle', { category: t(`cat.${a.category}`), hazard: t(`hazard.${a.hazard}`), zone: a.zoneName })}
                  </h2>
                  <span className="shrink-0 text-xs text-slate-500">{timeAgo(a.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{a.message}</p>
                {a.audience && a.audience !== 'all' && <span className="mt-2 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">For: {a.audience}</span>}
                {a.source === 'auto' && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                    {tips(a.hazard).slice(0, 3).map((tip) => <li key={tip}>{tip}</li>)}
                  </ul>
                )}
              </div>
            </div>
          </article>
        )))}

        {tab === 'official' && (official ?? []).map((o) => (
          <article key={o.id} className="card p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: LEVEL_COLOR[o.level] ?? '#475569' }}>{o.level}</span>
              <span className="text-xs font-bold text-slate-500">{o.agency}</span>
            </div>
            <h2 className="mt-2 font-bold text-brand-900">{o.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{o.detail}</p>
            <p className="mt-2 text-xs text-slate-500">{t('alerts.valid')}: {o.validUntil} · {o.source}</p>
          </article>
        ))}

        {tab === 'community' && (commList.length === 0 ? <Empty text="No community reports yet." /> : commList.map((r) => (
          <article key={r.id} className="card flex gap-3 p-4">
            {r.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.photoUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-brand-900">{t(`hazard.${r.hazard}`)} · {r.zoneName}</h2>
                <span className={`text-xs font-bold ${r.status === 'verified' ? 'text-emerald-600' : 'text-amber-600'}`}>{t(`report.${r.status}`)}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{r.description || '—'}</p>
              <p className="mt-1 text-xs text-slate-500">{timeAgo(r.createdAt)} · location shown to ~100 m</p>
            </div>
          </article>
        )))}
      </div>
    </main>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="card p-10 text-center text-slate-500">{text}</div>;
}

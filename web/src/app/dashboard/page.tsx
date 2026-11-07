'use client';
/**
 * ResQGrid COMMAND CENTER — the authority dashboard.
 * A dark "mission control" layout: City Threat Index (heartbeat gauge), zone hive,
 * live dark map, zone intel radar, risk seismograph (heat strip), trend, report triage
 * kanban, resource board, live event feed and broadcast composer.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity, AlertTriangle, BarChart3, Boxes, Clock, Cpu, Hexagon, Layers, LogOut, Map as MapIcon, Megaphone, Radio, Radar, ScanLine, Send, Siren, Users, Waves,
} from 'lucide-react';
import Logo from '@/components/Logo';
import MapView from '@/components/MapView';
import SimulationControl from '@/components/SimulationControl';
import { CategoryBadge, ScoreRing, StatusChips } from '@/components/RiskUI';
import Panel from '@/components/dashboard/Panel';
import PulseGauge from '@/components/dashboard/PulseGauge';
import HiveGrid from '@/components/dashboard/HiveGrid';
import HeatStrip from '@/components/dashboard/HeatStrip';
import TrendChart from '@/components/dashboard/TrendChart';
import HazardRadar from '@/components/dashboard/HazardRadar';
import EventTicker from '@/components/dashboard/EventTicker';
import TriageBoard from '@/components/dashboard/TriageBoard';
import ResourceBoard from '@/components/dashboard/ResourceBoard';
import BroadcastComposer from '@/components/dashboard/BroadcastComposer';
import SensorGrid from '@/components/dashboard/SensorGrid';
import AudiencePanel, { type SubStats } from '@/components/dashboard/AudiencePanel';
import { useLiveState, usePoll } from '@/hooks/usePoll';
import { CATEGORY_COLOR, CATEGORY_RANK } from '@/lib/risk';
import { fmtPeople, istTime } from '@/lib/format';
import type { Alert, Report, Resource, SensorStation, Snapshot } from '@/lib/types';

function Clock24() {
  const [now, setNow] = useState<string>('');
  useEffect(() => {
    const tick = () => setNow(istTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="flex items-center gap-1.5 font-mono text-sm text-white">
      <Clock size={14} className="text-cyan-300" /> {now} <span className="text-[10px] text-cc-mute">IST</span>
    </span>
  );
}

export default function CommandCenter() {
  const router = useRouter();
  const { data: state, reload } = useLiveState(3000);
  const { data: reports, reload: reloadReports } = usePoll<Report[]>('/api/reports', 5000);
  const { data: alerts, reload: reloadAlerts } = usePoll<Alert[]>('/api/alerts?limit=60', 4000);
  const { data: resources, reload: reloadResources } = usePoll<Resource[]>('/api/resources', 10000);
  const { data: history } = usePoll<Snapshot[]>('/api/history?minutes=120', 10000);
  const [sel, setSel] = useState<string | null>(null);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [satellite, setSatellite] = useState(false);
  const { data: sensors } = usePoll<SensorStation[]>('/api/sensors', 6000);
  const { data: subs } = usePoll<SubStats>('/api/subscriptions', 10000);

  const zones = useMemo(() => state?.zones ?? [], [state]);
  const ranked = useMemo(() => [...zones].sort((a, b) => b.risk.overall - a.risk.overall), [zones]);
  const zone = zones.find((z) => z.id === sel) ?? ranked[0] ?? null;
  const priority = ranked.filter((z) => CATEGORY_RANK[z.risk.category] >= 2);

  const selectZone = (id: string) => {
    setSel(id);
    const z = zones.find((x) => x.id === id);
    if (z) setFocus([z.lat, z.lng]);
  };

  const logout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  };

  const pending = (reports ?? []).filter((r) => r.status === 'pending').length;
  const deployed = (resources ?? []).filter((r) => r.status !== 'available').length;
  const kpis = [
    { label: 'Zones High / Critical', value: state ? `${state.city.highCount + state.city.criticalCount}` : '—', sub: state ? `${state.city.criticalCount} critical` : '', icon: Siren, tone: '#ef4444' },
    { label: 'Residents in risk zones', value: state ? fmtPeople(state.city.peopleAtRisk) : '—', sub: 'approx. population', icon: Users, tone: '#f97316' },
    { label: 'Reports awaiting triage', value: reports ? `${pending}` : '—', sub: `${reports?.length ?? 0} total`, icon: ScanLine, tone: '#eab308' },
    { label: 'AI anomalies flagged', value: state ? `${state.city.anomalies}` : '—', sub: `${deployed} resources engaged`, icon: Activity, tone: '#22d3ee' },
  ];

  return (
    <div className="cc min-h-screen">
      <div className="cc-scan min-h-screen">
        {/* ---------- top bar ---------- */}
        <header className="sticky top-0 z-[1000] border-b border-white/5 bg-[#060a13]/85 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex items-center gap-4">
              <Link href="/"><Logo dark size={32} /></Link>
              <span className="hidden h-6 w-px bg-white/10 sm:block" />
              <span className="hidden items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-300 sm:flex">
                <Radio size={14} className="live-dot text-red-500" /> Command Center
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusChips state={state} dark />
              <Clock24 />
              <Link href="/map" className="hidden rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 md:block">Citizen view</Link>
              <button onClick={logout} className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5">
                <LogOut size={13} /> Exit
              </button>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 gap-3 p-3 md:grid-cols-6 xl:grid-cols-12">
          {/* ---------- Row 1 ---------- */}
          <Panel title="City Threat Index" icon={Waves} className="md:col-span-3 xl:col-span-3">
            <PulseGauge value={state?.city.max ?? 0} />
            <p className="mt-1 text-center text-[11px] text-cc-mute">
              Worst zone now · city average <b className="font-mono text-white">{state?.city.avg ?? '—'}</b>
            </p>
            <div className="mt-3">
              <SimulationControl state={state} onChange={reload} dark />
            </div>
          </Panel>

          <div className="grid grid-cols-2 gap-3 md:col-span-3 xl:col-span-4">
            {kpis.map((k) => (
              <div key={k.label} className="cc-panel flex flex-col justify-between p-4">
                <div className="flex items-center justify-between">
                  <k.icon size={18} style={{ color: k.tone }} />
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: k.tone, boxShadow: `0 0 10px ${k.tone}` }} />
                </div>
                <div>
                  <p className="mt-3 font-mono text-3xl font-bold text-white">{k.value}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{k.label}</p>
                  <p className="text-[10px] text-cc-mute">{k.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <Panel title="Zone Hive" icon={Hexagon} className="md:col-span-6 xl:col-span-5" right={<span className="text-[10px] text-cc-mute">north ↑ · tap a city</span>}>
            <div className="grid h-full place-items-center">
              <HiveGrid zones={zones} selectedId={zone?.id ?? null} onSelect={selectZone} />
            </div>
          </Panel>

          {/* ---------- Row 2 ---------- */}
          <Panel title="Live Risk Map" icon={MapIcon} className="h-[480px] md:col-span-6 xl:col-span-7" bodyClass="overflow-hidden rounded-b-[18px]"
            right={<span className="flex items-center gap-3 text-[10px] text-cc-mute"><span className="hidden sm:inline">S shelter · H hospital · R rescue · ● report</span>
              <button onClick={() => setSatellite(!satellite)} className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-bold ${satellite ? 'bg-cyan-400 text-black' : 'bg-white/10 text-slate-200'}`}><Layers size={11} /> Satellite</button></span>}>
            <MapView dark satellite={satellite} zones={zones} resources={resources ?? []} reports={reports ?? []} selectedId={zone?.id ?? null} onSelect={selectZone} focus={focus} />
          </Panel>

          <Panel title="Zone Intel" icon={Radar} className="h-[480px] md:col-span-6 xl:col-span-5" bodyClass="flex flex-col gap-3 overflow-hidden p-4">
            {zone ? (
              <>
                <div className="flex items-center gap-3">
                  <ScoreRing value={zone.risk.overall} size={76} dark />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-xl font-bold text-white">{zone.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <CategoryBadge category={zone.risk.category} />
                      <span className="text-[11px] capitalize text-slate-400">{zone.risk.primaryHazard} · {zone.risk.source === 'ml' ? 'AI model' : 'rules'}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-cc-mute">{zone.state} · {fmtPeople(zone.population)} residents · {zone.river ?? 'no major river'}</p>
                  </div>
                  <div className="h-28 w-32 shrink-0"><HazardRadar zone={zone} /></div>
                </div>
                {zone.risk.anomaly && (
                  <p className="flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-2 text-[11px] text-cyan-200">
                    <AlertTriangle size={14} /> {zone.risk.anomalyNote}
                  </p>
                )}
                <ul className="space-y-1">
                  {(zone.risk.factors.length ? zone.risk.factors : [{ feature: 'none', label: zone.risk.reason, impact: 0 }]).map((f) => (
                    <li key={f.feature} className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="h-1.5 rounded-full bg-cyan-400" style={{ width: `${Math.max(6, Math.min(56, f.impact))}px` }} />
                      <span className="truncate">{f.label}</span>
                    </li>
                  ))}
                </ul>
                <div className="min-h-0 flex-1 border-t border-white/5 pt-2">
                  <p className="cc-title mb-1.5"><Siren size={12} className="text-red-400" /> Priority queue</p>
                  <div className="h-[calc(100%-22px)] overflow-y-auto pr-1">
                    {priority.length === 0 && <p className="py-4 text-center text-[11px] text-cc-mute">No High/Critical zones. Run a simulation to see the response flow.</p>}
                    <table className="w-full text-left text-[11px]">
                      <tbody>
                        {priority.map((z, i) => (
                          <tr key={z.id} onClick={() => selectZone(z.id)} className="cursor-pointer border-b border-white/5 hover:bg-white/5">
                            <td className="py-1.5 pr-2 font-mono text-cc-mute">{String(i + 1).padStart(2, '0')}</td>
                            <td className="py-1.5 pr-2 font-semibold text-white">{z.name}</td>
                            <td className="py-1.5 pr-2 capitalize text-slate-400">{z.risk.primaryHazard}</td>
                            <td className="py-1.5 pr-2 text-slate-400">{fmtPeople(z.population)}</td>
                            <td className="py-1.5 text-right font-mono font-bold" style={{ color: CATEGORY_COLOR[z.risk.category] }}>{z.risk.overall}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <p className="grid h-full place-items-center text-xs text-cc-mute">Loading…</p>
            )}
          </Panel>

          {/* ---------- Row 3 ---------- */}
          <Panel title="Risk Seismograph · last 2 h" icon={BarChart3} className="h-[330px] md:col-span-6 xl:col-span-6">
            <HeatStrip snapshots={history ?? []} zones={zones} onSelect={selectZone} />
          </Panel>
          <Panel title="Trend" icon={Activity} className="h-[330px] md:col-span-3 xl:col-span-3"
            right={<span className="flex gap-2 text-[10px]"><span className="text-red-400">■ worst</span><span className="text-cyan-300">■ avg</span></span>}>
            <TrendChart snapshots={history ?? []} />
          </Panel>
          <Panel title="Broadcast" icon={Megaphone} className="h-[330px] md:col-span-3 xl:col-span-3">
            <BroadcastComposer key={zone?.id ?? 'all'} defaultZone={zone?.id ?? null} onSent={reloadAlerts} />
          </Panel>

          {/* ---------- Row 4 ---------- */}
          <Panel title="Citizen Report Triage" icon={ScanLine} className="h-[420px] md:col-span-6 xl:col-span-6">
            <TriageBoard reports={reports ?? []} onChanged={() => { reloadReports(); reload(); }} onFocus={setFocus} />
          </Panel>
          <Panel title="Live Event Feed" icon={Radio} className="h-[420px] md:col-span-3 xl:col-span-3">
            <EventTicker alerts={alerts ?? []} reports={reports ?? []} />
          </Panel>
          <Panel title={`Resources ${zone ? '· near ' + zone.name : ''}`} icon={Boxes} className="h-[420px] md:col-span-3 xl:col-span-3">
            <ResourceBoard resources={resources ?? []} zone={zone} onChanged={reloadResources} />
          </Panel>

          {/* ---------- Row 5 ---------- */}
          <Panel title={`IoT Sensor Grid${zone ? ' · ' + zone.name : ''}`} icon={Cpu} className="h-[360px] md:col-span-6 xl:col-span-7">
            <SensorGrid
              local={(sensors ?? []).filter((s) => s.zoneId === zone?.id)}
              alarms={(sensors ?? []).filter((s) => s.status !== 'normal').sort((a, b) => (a.status === 'danger' ? -1 : 1) - (b.status === 'danger' ? -1 : 1))}
            />
          </Panel>
          <Panel title="Audience & Delivery" icon={Send} className="h-[360px] md:col-span-6 xl:col-span-5">
            <AudiencePanel stats={subs} alerts={alerts ?? []} />
          </Panel>
        </main>
        <footer className="px-4 pb-4 text-center text-[10px] text-cc-mute">
          ResQGrid Command Center · Team TerraPulse · data: Open-Meteo, OpenStreetMap/Esri · official feed is a demo adapter
        </footer>
      </div>
    </div>
  );
}

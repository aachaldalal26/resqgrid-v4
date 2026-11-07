'use client';
/**
 * ResQGrid home — a live product, not a brochure:
 * live India map + city risk search, live ticker, hazard pulse board, one-click disaster drills,
 * stakeholder switcher, animated data→AI→alert→action flow, preparedness score.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Bell, BrainCircuit, Building2, CloudRain, Cpu, Flame, GraduationCap, HandHeart, HeartPulse, Landmark,
  Loader2, Mail, MapPinned, MessageCircle, Mountain, Navigation, Radio, Satellite, Search, ShieldCheck, Siren, Smartphone,
  Truck, Users, Waves, Wind, type LucideIcon,
} from 'lucide-react';
import MapView from '@/components/MapView';
import PlaceSearch, { type PickedPlace } from '@/components/PlaceSearch';
import Footer from '@/components/Footer';
import { CategoryBadge, ScoreRing } from '@/components/RiskUI';
import { useI18n } from '@/i18n/I18nProvider';
import { useLiveState, usePoll } from '@/hooks/usePoll';
import { CATEGORY_COLOR, CATEGORY_RANK, HAZARDS } from '@/lib/risk';
import { SCENARIOS } from '@/lib/scenarios';
import type { Alert, Hazard, ScenarioId, ZoneState } from '@/lib/types';
import type { PlaceRisk } from '@/lib/place';

const HAZARD_META: Record<Hazard, { icon: LucideIcon; tint: string }> = {
  flood: { icon: Waves, tint: 'from-sky-500 to-blue-700' },
  storm: { icon: Wind, tint: 'from-violet-500 to-indigo-700' },
  heatwave: { icon: Flame, tint: 'from-amber-500 to-red-600' },
  landslide: { icon: Mountain, tint: 'from-emerald-600 to-stone-700' },
};

export default function Home() {
  const { t, tips } = useI18n();
  const router = useRouter();
  const { data, reload } = useLiveState(5000);
  const { data: alerts } = usePoll<Alert[]>('/api/alerts?limit=12', 8000);
  const zones = useMemo(() => data?.zones ?? [], [data]);
  const ranked = useMemo(() => [...zones].sort((a, b) => b.risk.overall - a.risk.overall), [zones]);

  // ---------------- search: a monitored city OR any place in India
  const [picked, setPicked] = useState<string | null>(null);
  const zone = zones.find((z) => z.id === picked) ?? null;
  const [placeReq, setPlaceReq] = useState<Extract<PickedPlace, { kind: 'place' }> | null>(null);
  const [place, setPlace] = useState<PlaceRisk | null>(null);
  const [placeErr, setPlaceErr] = useState<string | null>(null);
  const onPick = (p: PickedPlace) => {
    if (p.kind === 'zone') {
      setPicked(p.zoneId);
      setPlaceReq(null);
      setPlace(null);
    } else {
      setPicked(null);
      setPlace(null);
      setPlaceReq(p);
    }
  };
  useEffect(() => {
    if (!placeReq) return;
    let stop = false;
    const load = async () => {
      try {
        const qs = new URLSearchParams({ lat: String(placeReq.lat), lng: String(placeReq.lng), name: placeReq.name, state: placeReq.state, district: placeReq.district });
        const res = await fetch(`/api/place-risk?${qs}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        if (!stop) { setPlace(json); setPlaceErr(null); }
      } catch (e) {
        if (!stop) setPlaceErr(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => { stop = true; clearInterval(id); };
  }, [placeReq]);
  const placeHref = place ? `/map?${new URLSearchParams({ lat: String(place.lat), lng: String(place.lng), name: place.name, state: place.state, district: place.district ?? '' })}` : '';

  // ---------------- drills
  const [starting, setStarting] = useState<ScenarioId | 'reset' | null>(null);
  const startDrill = async (id: ScenarioId | null) => {
    setStarting(id ?? 'reset');
    await fetch('/api/simulate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario: id }) });
    await reload();
    setStarting(null);
    if (id) router.push('/map');
  };

  // ---------------- preparedness score (saved by /prepare)
  const [prep, setPrep] = useState(0);
  useEffect(() => {
    try {
      setPrep(Number(localStorage.getItem('rq_prep_score') || 0));
    } catch {
      /* ignore */
    }
  }, []);

  const hot = ranked.filter((z) => CATEGORY_RANK[z.risk.category] >= 2);
  const ticker = (alerts && alerts.length
    ? alerts.map((a) => ({ c: CATEGORY_COLOR[a.category], text: `${a.zoneName} · ${a.category} ${a.hazard}` }))
    : ranked.slice(0, 14).map((z) => ({ c: CATEGORY_COLOR[z.risk.category], text: `${z.name} · ${z.risk.overall} · ${z.risk.category}` })));

  return (
    <main className="overflow-x-hidden">
      {/* =============================== HERO =============================== */}
      <section className="relative bg-[#050b1c] text-white">
        <div className="hero-aurora pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-10 lg:grid-cols-[1fr_1.05fr] lg:pb-16 lg:pt-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
              <Radio size={13} className="live-dot text-red-400" /> {t('home.kicker')}
            </span>
            <h1 className="mt-5 font-display text-[2.6rem] font-bold leading-[1.02] tracking-tight sm:text-6xl">
              {t('home.h1a')}
              <span className="block bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 bg-clip-text text-transparent">{t('home.h1b')}</span>
            </h1>

            {/* Search any place in India */}
            <div className="mt-8 max-w-xl">
              <PlaceSearch dark zones={zones} onPick={onPick} placeholder={t('home.search')} locLabel={t('home.useLoc')} />
            </div>

            {zone ? (
              <CityCard zone={zone} tip={tips(zone.risk.primaryHazard)[0]} openLabel={t('home.openMap')} href={`/map?zone=${zone.id}`} />
            ) : place ? (
              <CityCard zone={place} tip={tips(place.risk.primaryHazard)[0]} openLabel={t('home.openMap')} href={placeHref}
                extra={place.nearestCity ? `Nearest monitored city: ${place.nearestCity.name} (${place.nearestCity.km} km)` : undefined} />
            ) : placeReq ? (
              <div className="mt-6 flex max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-white/[.07] p-4 text-sm text-slate-300">
                {placeErr ? <span className="text-amber-300">{placeErr}</span> : <><Loader2 size={18} className="animate-spin text-cyan-300" /> Checking live rain, river and terrain for {placeReq.name}…</>}
              </div>
            ) : (
              <div className="mt-6 grid max-w-xl grid-cols-3 gap-3">
                <HeroStat value={zones.length || '—'} label={t('landing.statZones')} />
                <HeroStat value={data ? data.city.highCount + data.city.criticalCount : '—'} label={t('landing.statHigh')} accent />
                <HeroStat value={data ? data.city.anomalies : '—'} label="AI anomalies" />
              </div>
            )}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/map" className="btn bg-white text-brand-900 hover:bg-blue-50"><MapPinned size={18} /> {t('landing.ctaMap')}</Link>
              <Link href="/report" className="btn border border-white/20 bg-white/5 text-white hover:bg-white/10"><Siren size={18} /> {t('landing.ctaReport')}</Link>
            </div>
          </div>

          {/* Live India map */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-cyan-500/20 via-transparent to-blue-600/30 blur-2xl" />
            <div className="relative h-[440px] overflow-hidden rounded-[1.6rem] border border-white/10 shadow-2xl sm:h-[520px]">
              <MapView dark zones={zones} selectedId={picked} onSelect={(id) => { setPicked(id); setPlaceReq(null); setPlace(null); }}
                pin={placeReq ? [placeReq.lat, placeReq.lng] : null}
                focus={zone ? [zone.lat, zone.lng] : placeReq ? [placeReq.lat, placeReq.lng] : null} focusZoom={placeReq ? 10 : 7} />
              <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded-xl border border-white/10 bg-[#050b1c]/85 px-3 py-2 text-xs backdrop-blur">
                <p className="font-bold text-white">Live risk · India</p>
                <div className="mt-1 flex gap-2.5">
                  {(['Low', 'Moderate', 'High', 'Critical'] as const).map((c) => (
                    <span key={c} className="flex items-center gap-1 text-slate-300"><span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[c] }} />{t(`cat.${c}`)}</span>
                  ))}
                </div>
              </div>
              {data?.sim.active && (
                <div className="absolute bottom-3 left-3 z-[500] rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                  ● Drill running · {Math.round(data.sim.intensity * 100)}%
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live ticker */}
        <div className="relative border-y border-white/10 bg-black/30 py-3">
          <div className="marquee flex w-max gap-10 whitespace-nowrap text-sm">
            {[...ticker, ...ticker].map((it, i) => (
              <span key={i} className="flex items-center gap-2 text-slate-300">
                <span className="h-2 w-2 rounded-full" style={{ background: it.c, boxShadow: `0 0 8px ${it.c}` }} />
                {it.text}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* =========================== INDIA RIGHT NOW =========================== */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <SectionHead title={t('home.now')} sub={t('home.nowSub')} />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HAZARDS.map((h) => {
            const Meta = HAZARD_META[h];
            const list = [...zones].sort((a, b) => b.risk.scores[h] - a.risk.scores[h]);
            const top = list[0];
            const atRisk = zones.filter((z) => z.risk.scores[h] >= 55).length;
            return (
              <Link key={h} href={top ? `/map?zone=${top.id}` : '/map'} className="group relative overflow-hidden rounded-3xl bg-white p-5 shadow-[0_10px_40px_-20px_rgba(11,31,77,.35)] ring-1 ring-slate-200 transition hover:-translate-y-1">
                <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${Meta.tint} opacity-15 transition group-hover:opacity-25`} />
                <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${Meta.tint} text-white shadow-lg`}><Meta.icon size={22} /></span>
                <p className="mt-4 text-sm font-bold uppercase tracking-wider text-slate-500">{t(`hazard.${h}`)}</p>
                <p className="mt-1 font-display text-4xl font-bold text-brand-900">{data ? atRisk : '—'}</p>
                <p className="text-xs font-semibold text-slate-500">{t('home.citiesAt')}</p>
                {top && (
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-500">{t('home.worst')}: <b className="text-slate-800">{top.name}</b></span>
                    <span className="font-mono font-bold" style={{ color: CATEGORY_COLOR[top.risk.scores[h] >= 75 ? 'Critical' : top.risk.scores[h] >= 55 ? 'High' : top.risk.scores[h] >= 30 ? 'Moderate' : 'Low'] }}>{Math.round(top.risk.scores[h])}</span>
                  </div>
                )}
                <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                  {list.map((z) => <span key={z.id} className="flex-1" style={{ background: z.risk.scores[h] >= 75 ? '#dc2626' : z.risk.scores[h] >= 55 ? '#f97316' : z.risk.scores[h] >= 30 ? '#eab308' : '#d1fae5' }} />)}
                </div>
              </Link>
            );
          })}
        </div>
        {data && hot.length === 0 && <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700"><ShieldCheck size={16} /> {t('home.calm')}</p>}
      </section>

      {/* =============================== DRILLS =============================== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0a1a44] via-[#0b2a6b] to-[#0e4a8a] py-16 text-white">
        <div className="hero-grid-lines pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-7xl px-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead dark title={t('home.drill')} sub={t('home.drillSub')} />
            {data?.sim.active && (
              <button onClick={() => startDrill(null)} className="btn border border-white/20 bg-white/10 text-white hover:bg-white/20">
                {starting === 'reset' && <Loader2 size={16} className="animate-spin" />} {t('home.reset')}
              </button>
            )}
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SCENARIOS.map((s) => {
              const active = data?.sim.active && data.sim.scenario === s.id;
              return (
                <button key={s.id} onClick={() => startDrill(s.id)} disabled={!!starting}
                  className={`group rounded-3xl border p-5 text-left transition hover:-translate-y-1 ${active ? 'border-red-400 bg-red-500/20' : 'border-white/15 bg-white/[.06] hover:bg-white/10'}`}>
                  <span className="text-4xl">{s.emoji}</span>
                  <p className="mt-3 font-display text-lg font-bold leading-snug">{s.title}</p>
                  <p className="mt-1.5 text-sm text-blue-100/80">{s.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-cyan-300">
                    {starting === s.id ? <Loader2 size={15} className="animate-spin" /> : active ? '● Running' : 'Start drill'} <ArrowRight size={15} className="transition group-hover:translate-x-1" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================== STAKEHOLDERS =========================== */}
      <Stakeholders title={t('home.who')} />

      {/* =============================== FLOW =============================== */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4">
          <SectionHead title={t('home.flow')} sub={t('home.flowSub')} />
          <div className="mt-10 grid gap-4 lg:grid-cols-4">
            <FlowCol step="01" title="Sense" color="#0ea5e9" items={[
              [CloudRain, 'Open-Meteo rain, temp & wind'], [Waves, 'River discharge (GloFAS)'], [Mountain, 'Terrain, slope & elevation'],
              [Landmark, 'IMD · NDMA · CWC advisories'], [Cpu, 'IoT rain & river sensors'], [Satellite, 'Satellite imagery'], [Users, 'Citizen photo reports'],
            ]} />
            <FlowCol step="02" title="Predict" color="#8b5cf6" items={[
              [BrainCircuit, 'Gradient-boosting risk model'], [Radio, 'Anomaly detection (IsolationForest)'], [ShieldCheck, 'CLIP photo verification'], [Search, 'Explainable reasons'],
            ]} />
            <FlowCol step="03" title="Alert" color="#f97316" items={[
              [Smartphone, 'App push notifications'], [MessageCircle, 'SMS & WhatsApp'], [Mail, 'Email'], [Bell, 'English · हिंदी · मराठी'], [GraduationCap, 'Targeted: schools & vulnerable'],
            ]} />
            <FlowCol step="04" title="Act" color="#16a34a" items={[
              [Navigation, 'Safe routes to shelters'], [Building2, 'Relief camps & hospitals'], [Truck, 'NDRF & rescue coordination'], [Siren, 'Authority command center'],
            ]} last />
          </div>
        </div>
      </section>

      {/* =========================== PREPAREDNESS =========================== */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid items-center gap-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-8 ring-1 ring-slate-200 md:grid-cols-[auto_1fr_auto] md:p-10">
          <ScoreRing value={prep} size={130} />
          <div>
            <h2 className="font-display text-3xl font-bold text-brand-900">{t('home.ready')}</h2>
            <p className="mt-2 max-w-xl text-slate-600">{t('home.readySub')}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              {['Learn from experts', 'Practice scenarios', 'Emergency kit', 'Track progress', 'Helplines'].map((x) => (
                <span key={x} className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">{x}</span>
              ))}
            </div>
          </div>
          <Link href="/prepare" className="btn-primary px-6 py-3 text-base">{t('home.startPrep')} <ArrowRight size={18} /></Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}

/* ------------------------------------------------------------------ pieces */

function CityCard({ zone, tip, openLabel, href, extra }: { zone: ZoneState; tip?: string; openLabel: string; href: string; extra?: string }) {
  return (
    <div className="mt-6 flex max-w-xl items-center gap-4 rounded-2xl border border-white/10 bg-white/[.07] p-4 backdrop-blur">
      <ScoreRing value={zone.risk.overall} size={84} dark />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-xl font-bold">{zone.name}</p>
          <CategoryBadge category={zone.risk.category} />
        </div>
        <p className="text-xs text-slate-400">{[(zone as PlaceRisk).district, zone.state].filter(Boolean).join(', ')} · {zone.risk.primaryHazard}</p>
        <p className="mt-1 line-clamp-2 text-sm text-slate-200">{zone.risk.reason}</p>
        {tip && CATEGORY_RANK[zone.risk.category] >= 1 && <p className="mt-1 text-xs font-semibold text-amber-300">→ {tip}</p>}
        {extra && <p className="mt-1 text-[11px] text-slate-400">{extra}</p>}
        <Link href={href} className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-cyan-300 hover:underline">{openLabel} <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}

function HeroStat({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.05] p-3">
      <p className={`font-mono text-2xl font-bold ${accent ? 'text-orange-300' : 'text-white'}`}>{value}</p>
      <p className="text-[11px] leading-tight text-slate-400">{label}</p>
    </div>
  );
}

function SectionHead({ title, sub, dark }: { title: string; sub?: string; dark?: boolean }) {
  return (
    <div>
      <h2 className={`font-display text-3xl font-bold tracking-tight sm:text-4xl ${dark ? 'text-white' : 'text-brand-900'}`}>{title}</h2>
      {sub && <p className={`mt-2 max-w-2xl ${dark ? 'text-blue-100/80' : 'text-slate-600'}`}>{sub}</p>}
    </div>
  );
}

function FlowCol({ step, title, color, items, last }: { step: string; title: string; color: string; items: [LucideIcon, string][]; last?: boolean }) {
  return (
    <div className="relative rounded-3xl border border-slate-200 p-5">
      {!last && <span className="flow-dash absolute -right-4 top-10 hidden h-0.5 w-8 lg:block" style={{ color }} />}
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl font-mono text-sm font-bold text-white" style={{ background: color }}>{step}</span>
        <p className="font-display text-xl font-bold text-brand-900">{title}</p>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map(([Icon, label]) => (
          <li key={label} className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            <Icon size={16} style={{ color }} /> {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

const STAKEHOLDERS: { id: string; label: string; icon: LucideIcon; headline: string; points: string[]; cta: [string, string] }[] = [
  { id: 'citizens', label: 'Citizens', icon: Users, headline: 'Know your risk and what to do — in your language.',
    points: ['Live risk score for your city with the reason behind it', 'Alerts by push, SMS, WhatsApp or email in English, Hindi and Marathi', 'Safe route to the nearest relief camp', 'Report hazards with a photo — AI verifies it'], cta: ['/map', 'Open live map'] },
  { id: 'schools', label: 'Schools & colleges', icon: GraduationCap, headline: 'Keep students safe with early, targeted advisories.',
    points: ['Institution-only alerts (closures, early dismissal)', 'Drill scenarios and quizzes for students', 'Heatwave and flood guidance for campuses', 'One-tap subscription for your institution'], cta: ['/subscribe?group=schools', 'Register your institution'] },
  { id: 'authorities', label: 'Local authorities', icon: Landmark, headline: 'One command center for the whole response.',
    points: ['City threat index, risk seismograph and priority queue', 'Citizen report triage with AI evidence', 'Broadcast to an area or a target group', 'IoT sensor grid and satellite view'], cta: ['/dashboard', 'Open command center'] },
  { id: 'responders', label: 'Emergency teams', icon: Truck, headline: 'Deploy faster to where it matters.',
    points: ['Shelters, hospitals and NDRF teams with live status', 'Resources sorted by distance to the hot zone', 'Risk-aware routing that avoids danger zones', 'Real-time event feed'], cta: ['/dashboard', 'See resources'] },
  { id: 'vulnerable', label: 'Vulnerable communities', icon: HeartPulse, headline: 'Priority alerts that everyone can understand.',
    points: ['Priority alerts for elderly, disabled and pregnant residents', 'Simple steps, large text and high-contrast mode', 'Works on weak internet — last data saved on device', 'Helplines one tap away'], cta: ['/subscribe?group=vulnerable', 'Sign up for priority alerts'] },
  { id: 'ngos', label: 'NGOs & developers', icon: HandHeart, headline: 'Open data for everyone helping on the ground.',
    points: ['Open JSON API for risk, alerts and shelters', 'IoT device ingestion endpoint', 'Volunteer alert group', 'Easy to integrate with existing systems'], cta: ['/developers', 'Explore the API'] },
];

function Stakeholders({ title }: { title: string }) {
  const [tab, setTab] = useState(STAKEHOLDERS[0].id);
  const s = STAKEHOLDERS.find((x) => x.id === tab)!;
  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <SectionHead title={title} />
      <div className="mt-8 grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="flex gap-2 overflow-x-auto lg:flex-col">
          {STAKEHOLDERS.map((x) => (
            <button key={x.id} onClick={() => setTab(x.id)}
              className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold transition ${tab === x.id ? 'bg-brand-900 text-white shadow-lg' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
              <x.icon size={19} /> {x.label}
            </button>
          ))}
        </div>
        <div key={s.id} className="animate-slide-in rounded-3xl bg-white p-7 ring-1 ring-slate-200">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-500 text-white"><s.icon size={26} /></span>
          <h3 className="mt-4 font-display text-2xl font-bold text-brand-900">{s.headline}</h3>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {s.points.map((p) => (
              <li key={p} className="flex gap-2.5 rounded-2xl bg-slate-50 p-3.5 text-sm text-slate-700">
                <ShieldCheck size={18} className="shrink-0 text-emerald-600" /> {p}
              </li>
            ))}
          </ul>
          <Link href={s.cta[0]} className="btn-primary mt-6">{s.cta[1]} <ArrowRight size={16} /></Link>
        </div>
      </div>
    </section>
  );
}

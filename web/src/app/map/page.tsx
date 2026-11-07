'use client';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Layers, Loader2, Navigation, X } from 'lucide-react';
import MapView from '@/components/MapView';
import ZoneDetail from '@/components/ZoneDetail';
import PlaceSearch, { type PickedPlace } from '@/components/PlaceSearch';
import SimulationControl from '@/components/SimulationControl';
import { CategoryBadge, StatusChips } from '@/components/RiskUI';
import { useLiveState, usePoll } from '@/hooks/usePoll';
import { useI18n } from '@/i18n/I18nProvider';
import { CATEGORY_COLOR } from '@/lib/risk';
import { CITY_CENTER, inCity } from '@/data/zones';
import type { Category, Report, Resource } from '@/lib/types';
import type { PlaceRisk } from '@/lib/place';

interface RouteResp {
  path: [number, number][];
  distanceKm: number;
  etaMin: number;
  avoided: string[];
  passesThrough: string[];
  forcedThroughDanger: boolean;
  startsInDanger: boolean;
  toName: string;
}

function getPosition(): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition((p) => resolve([p.coords.latitude, p.coords.longitude]), reject, { timeout: 7000, enableHighAccuracy: true });
  });
}

function MapPageInner() {
  const { t } = useI18n();
  const params = useSearchParams();
  const { data, reload } = useLiveState(4000);
  const { data: resources } = usePoll<Resource[]>('/api/resources', 15000);
  const { data: reports } = usePoll<Report[]>('/api/reports', 8000);
  const [sel, setSel] = useState<string | null>(params.get('zone'));
  const [route, setRoute] = useState<RouteResp | null>(null);
  const [from, setFrom] = useState<[number, number] | null>(null);
  const [routing, setRouting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [satellite, setSatellite] = useState(false);

  // Any place in India (from search, GPS or ?lat=&lng= in the URL)
  const initialPlace = params.get('lat') && params.get('lng')
    ? { kind: 'place' as const, lat: Number(params.get('lat')), lng: Number(params.get('lng')), name: params.get('name') || 'Selected place', state: params.get('state') || '', district: params.get('district') || '' }
    : null;
  const [placeReq, setPlaceReq] = useState<Extract<PickedPlace, { kind: 'place' }> | null>(initialPlace);
  const [place, setPlace] = useState<PlaceRisk | null>(null);
  useEffect(() => {
    if (!placeReq) return;
    let stop = false;
    const load = async () => {
      try {
        const qs = new URLSearchParams({ lat: String(placeReq.lat), lng: String(placeReq.lng), name: placeReq.name, state: placeReq.state, district: placeReq.district });
        const res = await fetch(`/api/place-risk?${qs}`, { cache: 'no-store' });
        if (res.ok && !stop) setPlace(await res.json());
      } catch {
        /* keep last */
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => { stop = true; clearInterval(id); };
  }, [placeReq]);
  const onPick = (p: PickedPlace) => {
    setRoute(null);
    if (p.kind === 'zone') {
      setSel(p.zoneId);
      setPlaceReq(null);
      setPlace(null);
    } else {
      setSel(null);
      setPlace(null);
      setPlaceReq(p);
    }
  };

  const zone = data?.zones.find((z) => z.id === sel) ?? null;
  const sorted = useMemo(() => (data ? [...data.zones].sort((a, b) => b.risk.overall - a.risk.overall) : []), [data]);
  const signature = data?.zones.map((z) => z.risk.category[0]).join('') ?? '';

  const computeRoute = useCallback(async (origin: [number, number]) => {
    const res = await fetch(`/api/route?fromLat=${origin[0]}&fromLng=${origin[1]}`, { cache: 'no-store' });
    if (!res.ok) {
      setNote(t('map.noRoute'));
      setRoute(null);
      return;
    }
    setRoute(await res.json());
  }, [t]);

  const findRoute = async () => {
    setRouting(true);
    setNote(t('map.locating'));
    let origin: [number, number] | null = null;
    try {
      const p = await getPosition();
      if (inCity(p[0], p[1])) origin = p;
    } catch {
      /* permission denied or unavailable */
    }
    if (!origin) {
      origin = placeReq ? [placeReq.lat, placeReq.lng] : zone ? [zone.lat, zone.lng] : CITY_CENTER;
      setNote(t('map.noLocation'));
    } else setNote(null);
    setFrom(origin);
    await computeRoute(origin);
    setRouting(false);
  };

  // Re-plan automatically when any zone's risk level changes (e.g. during a simulation)
  useEffect(() => {
    if (from && route) computeRoute(from);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <main className="flex h-[calc(100dvh-64px)] flex-col lg:flex-row">
      <div className="relative min-h-[55vh] flex-1">
        <MapView
          zones={data?.zones ?? []}
          resources={resources ?? []}
          reports={reports ?? []}
          route={route?.path}
          selectedId={sel}
          onSelect={(id) => { setSel(id); setPlaceReq(null); setPlace(null); }}
          userPos={from}
          pin={placeReq ? [placeReq.lat, placeReq.lng] : null}
          focusZoom={placeReq ? 11 : 9}
          focus={zone ? [zone.lat, zone.lng] : placeReq ? [placeReq.lat, placeReq.lng] : null}
          satellite={satellite}
        />
        <div className="pointer-events-none absolute left-14 right-3 top-3 z-[500] flex flex-wrap items-start justify-between gap-2">
          <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('map.legend')}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {(['Low', 'Moderate', 'High', 'Critical'] as Category[]).map((c) => (
                <span key={c} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <span className="h-3 w-3 rounded" style={{ background: CATEGORY_COLOR[c] }} />
                  {t(`cat.${c}`)}
                </span>
              ))}
            </div>
            <div className="mt-1.5 flex gap-3 text-[11px] text-slate-500">
              <span><b className="text-blue-600">S</b> {t('map.shelters')}</span>
              <span><b className="text-pink-600">H</b> {t('map.hospitals')}</span>
              <span><b className="text-violet-600">R</b> {t('map.rescue')}</span>
              <span><b className="text-amber-500">●</b> {t('map.reports')}</span>
            </div>
          </div>
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <StatusChips state={data} />
            <button onClick={() => setSatellite(!satellite)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow ${satellite ? 'bg-brand-900 text-white' : 'bg-white text-slate-700'}`}>
              <Layers size={14} /> {satellite ? 'Satellite on' : 'Satellite view'}
            </button>
          </div>
        </div>
        <div className="absolute bottom-3 left-3 right-3 z-[500] flex flex-col gap-2 sm:right-auto sm:max-w-md">
          {route && (
            <div className="rounded-2xl border border-brand-200 bg-white/95 p-3 shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-600">{t('map.routeTo')}</p>
                  <p className="font-bold text-brand-900">{route.toName}</p>
                  <p className="text-sm text-slate-600">
                    {t('map.distance')}: <b>{route.distanceKm} km</b> · {t('map.eta')}: <b>{route.etaMin} min</b>
                  </p>
                  {route.avoided.length > 0 && (
                    <p className="mt-1 text-xs font-semibold text-emerald-700">✓ {t('map.avoids')}: {route.avoided.join(', ')}</p>
                  )}
                  {route.startsInDanger && <p className="mt-1 text-xs font-semibold text-orange-600">You are inside a danger zone — this is the quickest way out.</p>}
                  {route.forcedThroughDanger && <p className="mt-1 text-xs font-semibold text-red-600">⚠ All paths cross a danger zone — move with extreme caution.</p>}
                </div>
                <button onClick={() => { setRoute(null); setFrom(null); }} aria-label={t('map.clearRoute')} className="text-slate-400 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>
            </div>
          )}
          <SimulationControl state={data} onChange={reload} />
        </div>
      </div>

      <aside className="w-full overflow-y-auto border-l border-slate-200 bg-white p-5 lg:w-[420px]">
        <div className="mb-3">
          <PlaceSearch zones={data?.zones ?? []} onPick={onPick} placeholder="Search village, city, district, state…" locLabel="Me" />
        </div>
        <button onClick={findRoute} disabled={routing || !data} className="btn-primary mb-2 w-full">
          {routing ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
          {routing ? t('map.routing') : t('map.safeRoute')}
        </button>
        {note && <p className="mb-3 text-xs text-slate-500">{note}</p>}

        {placeReq && !place ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Checking live rain, river and terrain for {placeReq.name}…</p>
        ) : place ? (
          <ZoneDetail zone={place} onBack={() => { setPlaceReq(null); setPlace(null); }} />
        ) : zone ? (
          <ZoneDetail zone={zone} onBack={() => setSel(null)} />
        ) : (
          <>
            <h2 className="mt-3 font-display text-xl font-bold text-brand-900">{t('map.zones')}</h2>
            <p className="mb-3 text-sm text-slate-500">{t('map.select')}</p>
            <ul className="space-y-1.5">
              {!data && Array.from({ length: 8 }).map((_, i) => <li key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
              {sorted.map((z) => (
                <li key={z.id}>
                  <button onClick={() => setSel(z.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-2.5 text-left transition hover:border-brand-200 hover:bg-brand-50/50">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg font-mono text-sm font-bold text-white" style={{ background: CATEGORY_COLOR[z.risk.category] }}>
                      {z.risk.overall}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-800">{z.name}</span>
                      <span className="block truncate text-xs text-slate-500">{z.risk.reason}</span>
                    </span>
                    <CategoryBadge category={z.risk.category} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </main>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={null}>
      <MapPageInner />
    </Suspense>
  );
}

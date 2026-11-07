'use client';
import { AlertTriangle, ChevronLeft, ShieldCheck, Users } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { fmtPeople } from '@/lib/format';
import type { Resource, ZoneState } from '@/lib/types';
import { CategoryBadge, ForecastChart, HazardBars, ScoreRing } from './RiskUI';

type Extra = { district?: string; nearestCity?: { name: string; km: number } | null; nearby?: (Resource & { km: number })[] };

/** Everything a resident needs about one zone (or any searched place): score, why, forecast, what to do. */
export default function ZoneDetail({ zone, onBack, dark = false }: { zone: ZoneState; onBack?: () => void; dark?: boolean }) {
  const { t, tips } = useI18n();
  const r = zone.risk;
  const sub = dark ? 'text-cc-mute' : 'text-slate-500';
  const head = `mb-2 text-xs font-bold uppercase tracking-wider ${dark ? 'text-cc-mute' : 'text-slate-500'}`;

  return (
    <div className="space-y-5">
      {onBack && (
        <button onClick={onBack} className={`flex items-center gap-1 text-sm font-semibold ${dark ? 'text-cyan-300' : 'text-brand-600'}`}>
          <ChevronLeft size={16} /> {t('map.back')}
        </button>
      )}
      <div className="flex items-center gap-4">
        <ScoreRing value={r.overall} dark={dark} />
        <div className="min-w-0">
          <h2 className={`font-display text-2xl font-bold ${dark ? 'text-white' : 'text-brand-900'}`}>{zone.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CategoryBadge category={r.category} />
            <span className={`text-xs font-semibold ${sub}`}>
              {t(`hazard.${r.primaryHazard}`)} · {r.source === 'ml' ? 'AI model' : 'Rule engine'}
            </span>
          </div>
          <p className={`mt-1.5 flex items-center gap-1 text-xs ${sub}`}>
            <Users size={13} /> {[(zone as Extra).district, zone.state].filter(Boolean).join(', ')}
            {zone.population > 0 ? ` · ${t('map.people')}: ${fmtPeople(zone.population)}` : ''}
            {zone.river ? ` · ${zone.river}` : ''}
          </p>
        </div>
      </div>

      {r.anomaly && (
        <div className="flex gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle size={18} className="shrink-0" />
          <div>
            <p className="font-bold">{t('map.anomaly')}</p>
            <p className="text-xs">{r.anomalyNote}</p>
          </div>
        </div>
      )}

      <section>
        <h3 className={head}>{t('map.why')}</h3>
        {r.factors.length ? (
          <ul className="space-y-1.5">
            {r.factors.map((f) => (
              <li key={f.feature} className="flex items-center gap-2 text-sm">
                <span className={`h-1.5 rounded-full ${dark ? 'bg-cyan-400' : 'bg-brand-500'}`} style={{ width: `${Math.min(48, 6 + f.impact)}px` }} />
                <span className={dark ? 'text-slate-200' : 'text-slate-700'}>{f.label}</span>
                <span className={`ml-auto font-mono text-xs ${sub}`}>+{Math.round(f.impact)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`text-sm ${sub}`}>{r.reason}</p>
        )}
      </section>

      <section>
        <h3 className={head}>{t('map.hazards')}</h3>
        <HazardBars scores={r.scores} dark={dark} />
      </section>

      <section>
        <h3 className={head}>{t('map.forecast')}</h3>
        <ForecastChart data={zone.forecast} dark={dark} />
      </section>

      {(zone as Extra).nearestCity && (
        <section>
          <h3 className={head}>Nearby help</h3>
          <p className={`mb-2 text-xs ${sub}`}>Nearest monitored city: <b>{(zone as Extra).nearestCity!.name}</b> ({(zone as Extra).nearestCity!.km} km) · terrain {zone.reliefM} m above low ground, slope {zone.slopeDeg}°</p>
          <ul className="space-y-1">
            {((zone as Extra).nearby ?? []).map((r) => (
              <li key={r.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                <span className="truncate text-slate-700">{r.type === 'shelter' ? '🏕️' : r.type === 'hospital' ? '🏥' : '🚒'} {r.name}</span>
                <span className="shrink-0 font-mono text-slate-500">{r.km} km</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!dark && (
        <section className="rounded-2xl bg-brand-50 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-brand-700">
            <ShieldCheck size={16} /> {t('map.tips')}
          </h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
            {tips(r.primaryHazard).map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

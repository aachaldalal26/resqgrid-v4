'use client';
/** Small reusable risk widgets: badge, score ring, hazard bars, forecast chart, status chips. */
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CloudRain, Flame, Mountain, Wind, type LucideIcon } from 'lucide-react';
import { CATEGORY_COLOR, HAZARDS, categorize } from '@/lib/risk';
import { useI18n } from '@/i18n/I18nProvider';
import type { Category, ForecastPoint, Hazard, HazardScores, LiveState } from '@/lib/types';

export const HAZARD_ICON: Record<Hazard, LucideIcon> = { flood: CloudRain, landslide: Mountain, heatwave: Flame, storm: Wind };

export function CategoryBadge({ category, className = '' }: { category: Category; className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${className}`}
      style={{ background: CATEGORY_COLOR[category] }}
    >
      {t(`cat.${category}`)}
    </span>
  );
}

export function ScoreRing({ value, size = 92, dark = false }: { value: number; size?: number; dark?: boolean }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const color = CATEGORY_COLOR[categorize(value)];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Risk score ${value} of 100`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke={dark ? '#1b2740' : '#e2e8f0'} strokeWidth="10" />
      <circle
        cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray .8s ease' }}
      />
      <text x="50" y="55" textAnchor="middle" fontSize="26" fontWeight="800" fill={dark ? '#fff' : '#0b1f4d'} fontFamily="JetBrains Mono, monospace">
        {value}
      </text>
    </svg>
  );
}

export function HazardBars({ scores, dark = false }: { scores: HazardScores; dark?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      {HAZARDS.map((h) => {
        const Icon = HAZARD_ICON[h];
        const v = Math.round(scores[h]);
        return (
          <div key={h} className="flex items-center gap-2 text-xs">
            <Icon size={14} className={dark ? 'text-cc-mute' : 'text-slate-500'} />
            <span className={`w-20 font-semibold ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{t(`hazard.${h}`)}</span>
            <div className={`h-2 flex-1 overflow-hidden rounded-full ${dark ? 'bg-[#1b2740]' : 'bg-slate-100'}`}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v}%`, background: CATEGORY_COLOR[categorize(v)] }} />
            </div>
            <span className={`w-8 text-right font-mono font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{v}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ForecastChart({ data, dark = false }: { data: ForecastPoint[]; dark?: boolean }) {
  const axis = dark ? '#7d8db0' : '#64748b';
  return (
    <div className="h-36 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#1b2740' : '#e2e8f0'} vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: axis }} interval={5} tickLine={false} axisLine={false} />
          <YAxis yAxisId="r" tick={{ fontSize: 10, fill: axis }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="t" orientation="right" hide domain={['dataMin - 2', 'dataMax + 2']} />
          <Tooltip
            contentStyle={{ background: dark ? '#0c1322' : '#fff', border: `1px solid ${dark ? '#1b2740' : '#e2e8f0'}`, borderRadius: 10, fontSize: 12 }}
            formatter={(v: number, name: string) => (name === 'rain' ? [`${v} mm`, 'Rain'] : [`${v} °C`, 'Temp'])}
          />
          <Bar yAxisId="r" dataKey="rain" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Line yAxisId="t" dataKey="temp" stroke="#f97316" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusChips({ state, dark = false }: { state: LiveState | null; dark?: boolean }) {
  const { t } = useI18n();
  if (!state) return null;
  const chip = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${dark ? 'bg-white/5 text-slate-300 border border-white/10' : 'bg-white/90 text-slate-700 border border-slate-200 shadow-sm'}`;
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={chip}>
        <span className={`live-dot h-2 w-2 rounded-full ${state.weather.delayed ? 'bg-amber-500 text-amber-500' : 'bg-emerald-500 text-emerald-500'}`} />
        {state.weather.delayed ? t('status.delayed') : t('status.live')}
      </span>
      <span className={chip}>
        <span className={`h-2 w-2 rounded-full ${state.ml ? 'bg-cyan-500' : 'bg-slate-400'}`} />
        {state.ml ? t('status.mlOn') : t('status.mlOff')}
      </span>
      {state.sim.active && (
        <span className={`${chip} !border-red-400/50 !text-red-500`}>
          <span className="live-dot h-2 w-2 rounded-full bg-red-500 text-red-500" />
          {t('status.simulation')} · {Math.round(state.sim.intensity * 100)}%
        </span>
      )}
    </div>
  );
}

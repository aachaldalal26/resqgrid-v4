'use client';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { CATEGORY_COLOR } from '@/lib/risk';
import type { ZoneState } from '@/lib/types';

export default function HazardRadar({ zone }: { zone: ZoneState }) {
  const data = (['flood', 'landslide', 'heatwave', 'storm'] as const).map((h) => ({ h: h[0].toUpperCase() + h.slice(1), v: Math.round(zone.risk.scores[h]) }));
  const c = CATEGORY_COLOR[zone.risk.category];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#22304d" />
        <PolarAngleAxis dataKey="h" tick={{ fontSize: 10, fill: '#9fb0d4' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar dataKey="v" stroke={c} fill={c} fillOpacity={0.35} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

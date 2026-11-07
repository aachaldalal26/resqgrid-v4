'use client';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { hhmm } from '@/lib/format';
import type { Snapshot } from '@/lib/types';

/** City average vs. worst zone over time. */
export default function TrendChart({ snapshots }: { snapshots: Snapshot[] }) {
  const data = useMemo(() => {
    const by = new Map<string, number[]>();
    snapshots.forEach((s) => by.set(s.at, [...(by.get(s.at) ?? []), s.overall]));
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-60).map(([at, v]) => ({
      t: hhmm(at).slice(0, 5),
      avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length),
      max: Math.max(...v),
    }));
  }, [snapshots]);

  if (data.length < 2) return <p className="grid h-full place-items-center text-xs text-cc-mute">Waiting for history…</p>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -26, bottom: 0 }}>
        <defs>
          <linearGradient id="tMax" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ef4444" stopOpacity=".5" /><stop offset="1" stopColor="#ef4444" stopOpacity="0" /></linearGradient>
          <linearGradient id="tAvg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22d3ee" stopOpacity=".5" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></linearGradient>
        </defs>
        <CartesianGrid stroke="#16213a" vertical={false} />
        <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#7d8db0' }} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#7d8db0' }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: '#0c1322', border: '1px solid #1b2740', borderRadius: 10, fontSize: 12, color: '#fff' }} />
        <Area type="monotone" dataKey="max" name="Worst zone" stroke="#ef4444" strokeWidth={2} fill="url(#tMax)" />
        <Area type="monotone" dataKey="avg" name="City average" stroke="#22d3ee" strokeWidth={2} fill="url(#tAvg)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

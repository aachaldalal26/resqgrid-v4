'use client';
import { CATEGORY_COLOR } from '@/lib/risk';
import type { ZoneState } from '@/lib/types';

/**
 * "Hive" view: every zone as a hexagon cell, laid out north→south / west→east
 * so it reads like a mini-map. Glows when Critical. Click to focus a zone.
 */
export default function HiveGrid({ zones, selectedId, onSelect }: { zones: ZoneState[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const r = 30;
  const w = Math.sqrt(3) * r;
  const perRow = 6;
  const rows: ZoneState[][] = [];
  [...zones].sort((a, b) => b.lat - a.lat).forEach((z, i) => {
    const ri = Math.floor(i / perRow);
    (rows[ri] ||= []).push(z);
  });
  rows.forEach((row) => row.sort((a, b) => a.lng - b.lng));
  const width = perRow * w + w / 2 + 8;
  const height = 2 * r + (rows.length - 1) * 1.5 * r + 8;
  const hex = (cx: number, cy: number) =>
    Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 180) * (60 * k - 90);
      return `${cx + (r - 2) * Math.cos(a)},${cy + (r - 2) * Math.sin(a)}`;
    }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full max-h-[270px] w-full" role="list" aria-label="Zone hive">
      {rows.map((row, ri) =>
        row.map((z, ci) => {
          const cx = 4 + w / 2 + ci * w + (ri % 2 ? w / 2 : 0);
          const cy = 4 + r + ri * 1.5 * r;
          const c = CATEGORY_COLOR[z.risk.category];
          const sel = z.id === selectedId;
          const short = z.name.length > 11 ? z.name.slice(0, 10) + '.' : z.name;
          return (
            <g key={z.id} role="listitem" tabIndex={0} onClick={() => onSelect(z.id)} onKeyDown={(e) => e.key === 'Enter' && onSelect(z.id)}
              className={`cursor-pointer outline-none ${z.risk.category === 'Critical' ? 'hex-critical' : ''}`}>
              <title>{`${z.name}: ${z.risk.overall} (${z.risk.category})`}</title>
              <polygon points={hex(cx, cy)} fill={c} fillOpacity={0.18 + z.risk.overall / 160} stroke={sel ? '#fff' : c} strokeWidth={sel ? 2.5 : 1.2} style={{ transition: 'fill-opacity .8s' }} />
              <text x={cx} y={cy - 3} textAnchor="middle" fill="#e6eeff" fontSize="7.5" fontWeight="600">{short}</text>
              <text x={cx} y={cy + 10} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700" fontFamily="JetBrains Mono, monospace">{z.risk.overall}</text>
              {z.risk.anomaly && <circle cx={cx + r * 0.55} cy={cy - r * 0.45} r="3.5" fill="#22d3ee"><animate attributeName="opacity" values="1;.2;1" dur="1s" repeatCount="indefinite" /></circle>}
            </g>
          );
        }),
      )}
    </svg>
  );
}

'use client';
import { useId } from 'react';
import { CATEGORY_COLOR, categorize } from '@/lib/risk';

/** "City Threat Index": half-dial gauge + a heartbeat line that beats faster as risk rises. */
export default function PulseGauge({ value }: { value: number }) {
  const id = useId().replace(/:/g, '');
  const cat = categorize(value);
  const color = CATEGORY_COLOR[cat];
  const R = 80;
  const C = Math.PI * R;
  const angle = Math.PI * (1 - value / 100);
  const nx = 100 + 64 * Math.cos(angle);
  const ny = 100 - 64 * Math.sin(angle);
  const amp = 5 + value * 0.3;
  const beat = (x: number) => `L${x},40 L${x + 8},${40 - amp} L${x + 16},${40 + amp * 0.55} L${x + 22},40`;
  const ecg = `M0,40 L36,40 ${beat(36)} L92,40 ${beat(92)} L150,40 ${beat(150)} L200,40`;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 112" className="w-full max-w-[250px]" role="img" aria-label={`City threat index ${value} of 100, ${cat}`}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" x2="1">
            <stop offset="0" stopColor="#16a34a" />
            <stop offset=".45" stopColor="#eab308" />
            <stop offset=".7" stopColor="#f97316" />
            <stop offset="1" stopColor="#dc2626" />
          </linearGradient>
        </defs>
        {Array.from({ length: 21 }).map((_, i) => {
          const a = Math.PI * (1 - i / 20);
          return (
            <line key={i} x1={100 + 92 * Math.cos(a)} y1={100 - 92 * Math.sin(a)} x2={100 + (i % 5 ? 88 : 84) * Math.cos(a)} y2={100 - (i % 5 ? 88 : 84) * Math.sin(a)} stroke="#2a3a5c" strokeWidth={i % 5 ? 1 : 2} />
          );
        })}
        <path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke="#16213a" strokeWidth="13" strokeLinecap="round" />
        <path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke={`url(#g${id})`} strokeWidth="13" strokeLinecap="round" strokeDasharray={`${(value / 100) * C} ${C}`} style={{ transition: 'stroke-dasharray 1s ease' }} />
        <line x1="100" y1="100" x2={nx} y2={ny} stroke="#fff" strokeWidth="3" strokeLinecap="round" style={{ transition: 'all 1s ease' }} />
        <circle cx="100" cy="100" r="6" fill="#fff" />
        <circle cx="100" cy="100" r="2.5" fill={color} />
        <text x="100" y="78" textAnchor="middle" fill="#fff" fontSize="30" fontWeight="700" fontFamily="JetBrains Mono, monospace">{value}</text>
      </svg>
      <p className="-mt-1 text-xs font-bold uppercase tracking-[0.3em]" style={{ color }}>{cat}</p>
      <svg viewBox="0 0 200 80" className="mt-1 h-10 w-full" preserveAspectRatio="none" aria-hidden>
        <path d={ecg} fill="none" stroke={color} strokeOpacity=".2" strokeWidth="2" />
        <path d={ecg} fill="none" stroke={color} strokeWidth="2.2" className="ecg-line" style={{ animationDuration: `${Math.max(0.7, 2.8 - value / 40)}s`, filter: `drop-shadow(0 0 4px ${color})` }} />
      </svg>
    </div>
  );
}

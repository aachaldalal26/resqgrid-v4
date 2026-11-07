'use client';
import dynamic from 'next/dynamic';
import type { RiskMapProps } from './RiskMap';

/** Client-only wrapper (Leaflet needs `window`). */
const RiskMap = dynamic(() => import('./RiskMap'), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center text-sm text-slate-400">Loading map…</div>,
});

export default function MapView(props: RiskMapProps) {
  return <RiskMap {...props} />;
}

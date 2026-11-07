'use client';
import { useState } from 'react';
import { FlaskConical, Square } from 'lucide-react';
import { SCENARIOS } from '@/lib/scenarios';
import type { LiveState, ScenarioId } from '@/lib/types';

/** Demo-mode switch: start a disaster scenario or return to live data. */
export default function SimulationControl({ state, onChange, dark = false }: { state: LiveState | null; onChange?: () => void; dark?: boolean }) {
  const [busy, setBusy] = useState(false);
  const active = state?.sim.active ? state.sim.scenario : null;

  const run = async (scenario: ScenarioId | null) => {
    setBusy(true);
    try {
      await fetch('/api/simulate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario }) });
      onChange?.();
    } finally {
      setBusy(false);
    }
  };

  const base = dark ? 'border-white/10 bg-[#0c1322]/95 text-slate-200' : 'border-slate-200 bg-white/95 text-slate-800';
  return (
    <div className={`rounded-2xl border p-3 shadow-lg backdrop-blur ${base}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest ${dark ? 'text-cyan-300' : 'text-brand-600'}`}>
          <FlaskConical size={14} /> Demo simulation
        </p>
        {active && (
          <button disabled={busy} onClick={() => run(null)} className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-bold text-white hover:bg-black">
            <Square size={11} /> Back to live
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            disabled={busy}
            title={s.description}
            onClick={() => run(s.id)}
            className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
              active === s.id
                ? 'bg-red-600 text-white shadow-[0_0_0_3px_rgba(220,38,38,.25)]'
                : dark ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'
            }`}
          >
            {s.emoji} {s.title}
          </button>
        ))}
      </div>
      {active && state && (
        <div className="mt-2">
          <div className={`h-1.5 overflow-hidden rounded-full ${dark ? 'bg-white/10' : 'bg-slate-100'}`}>
            <div className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 transition-all duration-1000" style={{ width: `${state.sim.intensity * 100}%` }} />
          </div>
          <p className={`mt-1 text-[10px] ${dark ? 'text-cc-mute' : 'text-slate-500'}`}>Scenario intensity {Math.round(state.sim.intensity * 100)}% — ramps up over 45 s</p>
        </div>
      )}
    </div>
  );
}

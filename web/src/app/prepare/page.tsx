'use client';
/** Learn from experts → Practice scenarios → Emergency kit → Track progress (the preparedness cycle from the PPT). */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, ClipboardCheck, Phone, RotateCcw, Target, Trophy, XCircle } from 'lucide-react';
import Footer from '@/components/Footer';
import { ScoreRing } from '@/components/RiskUI';
import { HELPLINES, KIT, MODULES, QUESTIONS } from '@/data/preparedness';

type Progress = { read: string[]; kit: number[]; answers: Record<string, number> };
const EMPTY: Progress = { read: [], kit: [], answers: {} };

export default function PreparePage() {
  const [p, setP] = useState<Progress>(EMPTY);
  const [mod, setMod] = useState(MODULES[0].id);
  const [stage, setStage] = useState<'before' | 'during' | 'after'>('before');

  useEffect(() => {
    try {
      setP({ ...EMPTY, ...JSON.parse(localStorage.getItem('rq_prep') || '{}') });
    } catch {
      /* ignore */
    }
  }, []);

  const correct = QUESTIONS.filter((q) => p.answers[q.id] === q.answer).length;
  const score = useMemo(
    () => Math.round((p.read.length / MODULES.length) * 35 + (p.kit.length / KIT.length) * 25 + (correct / QUESTIONS.length) * 40),
    [p, correct],
  );

  const save = (next: Progress) => {
    setP(next);
    try {
      localStorage.setItem('rq_prep', JSON.stringify(next));
      const s = Math.round((next.read.length / MODULES.length) * 35 + (next.kit.length / KIT.length) * 25 +
        (QUESTIONS.filter((q) => next.answers[q.id] === q.answer).length / QUESTIONS.length) * 40);
      localStorage.setItem('rq_prep_score', String(s));
    } catch {
      /* ignore */
    }
  };

  const m = MODULES.find((x) => x.id === mod)!;
  const markRead = () => !p.read.includes(m.id) && save({ ...p, read: [...p.read, m.id] });
  const level = score >= 80 ? 'Disaster-ready champion' : score >= 50 ? 'Well prepared' : score >= 20 ? 'Getting there' : 'Just starting';

  return (
    <main>
      {/* Progress header */}
      <section className="bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-700 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-100">Prepare · Practice · Progress</p>
            <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">Be ready before the warning comes.</h1>
            <p className="mt-3 max-w-2xl text-emerald-50/90">Learn what experts recommend, practise real-life scenarios and build your emergency kit. Your preparedness score is saved on this device.</p>
            <div className="mt-6 grid max-w-xl grid-cols-3 gap-3 text-center">
              <Stat icon={BookOpen} value={`${p.read.length}/${MODULES.length}`} label="Lessons learned" />
              <Stat icon={Target} value={`${correct}/${QUESTIONS.length}`} label="Drills correct" />
              <Stat icon={ClipboardCheck} value={`${p.kit.length}/${KIT.length}`} label="Kit items ready" />
            </div>
          </div>
          <div className="flex flex-col items-center rounded-3xl bg-white/10 p-6 backdrop-blur">
            <div className="rounded-full bg-white p-2"><ScoreRing value={score} size={140} /></div>
            <p className="mt-3 flex items-center gap-2 font-bold"><Trophy size={18} className="text-amber-300" /> {level}</p>
            <button onClick={() => save(EMPTY)} className="mt-2 flex items-center gap-1 text-xs text-emerald-100 hover:text-white"><RotateCcw size={12} /> Reset progress</button>
          </div>
        </div>
      </section>

      {/* 1. Learn */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <StepTitle n="1" title="Learn from experts" sub="What to do before, during and after each disaster." />
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {MODULES.map((x) => (
            <button key={x.id} onClick={() => { setMod(x.id); setStage('before'); }}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 font-semibold transition ${mod === x.id ? 'bg-brand-900 text-white' : 'bg-white ring-1 ring-slate-200 hover:bg-slate-50'}`}>
              <span className="text-xl">{x.emoji}</span> {x.title}
              {p.read.includes(x.id) && <CheckCircle2 size={16} className="text-emerald-500" />}
            </button>
          ))}
        </div>
        <div className="card mt-4 overflow-hidden">
          <div className="flex border-b border-slate-100">
            {(['before', 'during', 'after'] as const).map((s) => (
              <button key={s} onClick={() => setStage(s)} className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider ${stage === s ? 'border-b-2 border-brand-500 text-brand-600' : 'text-slate-400'}`}>{s}</button>
            ))}
          </div>
          <ol className="grid gap-3 p-6 sm:grid-cols-2">
            {m[stage].map((tip, i) => (
              <li key={tip} className="flex gap-3 rounded-2xl bg-slate-50 p-4 text-slate-700">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500 text-xs font-bold text-white">{i + 1}</span> {tip}
              </li>
            ))}
          </ol>
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <p className="text-xs text-slate-500">Based on NDMA public guidelines.</p>
            <button onClick={markRead} disabled={p.read.includes(m.id)} className="btn-primary">
              {p.read.includes(m.id) ? <><CheckCircle2 size={16} /> Learned</> : 'Mark as learned'}
            </button>
          </div>
        </div>
      </section>

      {/* 2. Practice */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4">
          <StepTitle n="2" title="Practice scenarios" sub="What would you do? Pick an answer to see the expert explanation." />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {QUESTIONS.map((q) => {
              const chosen = p.answers[q.id];
              const done = chosen !== undefined;
              return (
                <div key={q.id} className="rounded-3xl border border-slate-200 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{q.hazard}</p>
                  <p className="mt-1 font-semibold text-brand-900">{q.scenario}</p>
                  <div className="mt-3 space-y-2">
                    {q.options.map((o, i) => {
                      const right = done && i === q.answer;
                      const wrong = done && i === chosen && i !== q.answer;
                      return (
                        <button key={o} onClick={() => save({ ...p, answers: { ...p.answers, [q.id]: i } })}
                          className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${right ? 'border-emerald-400 bg-emerald-50 font-semibold text-emerald-800' : wrong ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                          {right ? <CheckCircle2 size={16} /> : wrong ? <XCircle size={16} /> : <span className="h-4 w-4 rounded-full border-2 border-slate-300" />} {o}
                        </button>
                      );
                    })}
                  </div>
                  {done && <p className={`mt-3 rounded-xl p-3 text-sm ${chosen === q.answer ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{chosen === q.answer ? '✓ Correct. ' : '✗ Not quite. '}{q.why}</p>}
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-sm text-slate-600">
            Want to see how a whole city responds? <Link href="/" className="font-semibold text-brand-600 hover:underline">Run a live disaster drill</Link> from the home page.
          </p>
        </div>
      </section>

      {/* 3. Kit + helplines */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-14 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <StepTitle n="3" title="Build your emergency kit" sub="Tick what you already have at home." />
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {KIT.map((item, i) => {
              const on = p.kit.includes(i);
              return (
                <label key={item} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-sm transition ${on ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={on} onChange={() => save({ ...p, kit: on ? p.kit.filter((k) => k !== i) : [...p.kit, i] })} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                  {item}
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <StepTitle n="4" title="Emergency helplines" sub="Tap to call." />
          <div className="mt-6 grid grid-cols-2 gap-2">
            {HELPLINES.map(([num, label]) => (
              <a key={num} href={`tel:${num}`} className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-100 transition hover:bg-red-100">
                <p className="flex items-center gap-2 font-mono text-2xl font-bold text-red-700"><Phone size={18} /> {num}</p>
                <p className="mt-1 text-xs font-semibold text-red-900/80">{label}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof BookOpen; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <Icon size={18} className="mx-auto text-emerald-100" />
      <p className="mt-1 font-mono text-xl font-bold">{value}</p>
      <p className="text-[11px] text-emerald-50/80">{label}</p>
    </div>
  );
}

function StepTitle({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-900 font-mono text-lg font-bold text-white">{n}</span>
      <div>
        <h2 className="font-display text-3xl font-bold text-brand-900">{title}</h2>
        <p className="text-slate-600">{sub}</p>
      </div>
    </div>
  );
}

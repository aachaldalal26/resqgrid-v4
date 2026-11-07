'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, Loader2, ShieldAlert, User } from 'lucide-react';

function LoginInner() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/dashboard';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (role: 'citizen' | 'authority') => {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role, code }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error || 'Login failed');
    router.push(role === 'authority' ? next : '/map');
    router.refresh();
  };

  return (
    <main className="mx-auto grid max-w-4xl gap-5 px-4 py-14 md:grid-cols-2">
      <div className="card p-7">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><User /></span>
        <h1 className="mt-4 font-display text-2xl font-bold text-brand-900">Citizen</h1>
        <p className="mt-1 text-sm text-slate-600">See live risk for your area, get alerts and report hazards. No account needed.</p>
        <button onClick={() => login('citizen')} disabled={busy} className="btn-ghost mt-6 w-full">Continue as citizen</button>
      </div>
      <div className="card p-7">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600"><ShieldAlert /></span>
        <h2 className="mt-4 font-display text-2xl font-bold text-brand-900">Authority</h2>
        <p className="mt-1 text-sm text-slate-600">Disaster cell, PMC, fire brigade and NDRF staff — open the Command Center.</p>
        <label className="label mt-5" htmlFor="code">Access code</label>
        <div className="relative">
          <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input id="code" type="password" className="input pl-9" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login('authority')} placeholder="Demo code: resq2026" />
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
        <button onClick={() => login('authority')} disabled={busy || !code} className="btn-primary mt-4 w-full">
          {busy && <Loader2 size={16} className="animate-spin" />} Open Command Center
        </button>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Bell, CheckCircle2, GraduationCap, HandHeart, HeartPulse, Loader2, Mail, MessageCircle, Smartphone, Truck, Users, type LucideIcon } from 'lucide-react';
import Footer from '@/components/Footer';
import { ZONES } from '@/data/zones';
import type { Channel } from '@/lib/types';

const GROUPS: { id: string; label: string; icon: LucideIcon; desc: string }[] = [
  { id: 'residents', label: 'Resident', icon: Users, desc: 'Alerts and safety steps for my city' },
  { id: 'schools', label: 'School / college', icon: GraduationCap, desc: 'Closure & campus advisories for an institution' },
  { id: 'vulnerable', label: 'Vulnerable person / caregiver', icon: HeartPulse, desc: 'Priority alerts for elderly, disabled, pregnant' },
  { id: 'responders', label: 'Emergency responder', icon: Truck, desc: 'Deployment and coordination alerts' },
  { id: 'ngos', label: 'NGO / volunteer', icon: HandHeart, desc: 'Relief and volunteer call-outs' },
];
const CHANNELS: { id: Channel; label: string; icon: LucideIcon }[] = [
  { id: 'push', label: 'App push', icon: Bell },
  { id: 'sms', label: 'SMS', icon: Smartphone },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'email', label: 'Email', icon: Mail },
];

function SubscribeInner() {
  const params = useSearchParams();
  const [group, setGroup] = useState(GROUPS.some((g) => g.id === params.get('group')) ? params.get('group')! : 'residents');
  const [zoneId, setZoneId] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [channels, setChannels] = useState<Channel[]>(['push']);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ zoneName: string; channels: Channel[] } | null>(null);

  const toggle = (c: Channel) => setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (channels.includes('push') && typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission();
      const res = await fetch('/api/subscriptions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, zoneId, group, channels, contact }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      try {
        localStorage.setItem('rq_zone', zoneId);
        localStorage.setItem('rq_group', group);
      } catch {
        /* ignore */
      }
      setDone({ zoneName: json.zoneName, channels: json.channels });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <div className="card p-8 text-center">
          <CheckCircle2 className="mx-auto text-emerald-500" size={56} />
          <h1 className="mt-3 font-display text-2xl font-bold text-brand-900">You&apos;re subscribed</h1>
          <p className="mt-2 text-slate-600">You&apos;ll get {GROUPS.find((g) => g.id === group)?.label.toLowerCase()} alerts for <b>{done.zoneName}</b> via {done.channels.join(', ')}.</p>
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Demo note: app push works now; SMS, WhatsApp and email delivery are counted and logged — connect a gateway (e.g. Twilio, MSG91) to send them for real.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/alerts" className="btn-primary">See my alerts</Link>
            <Link href="/prepare" className="btn-ghost">Get prepared</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-display text-4xl font-bold text-brand-900">Get disaster alerts</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Free, location-based alerts with clear actions — for residents, schools &amp; colleges, vulnerable communities, responders and NGOs.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="card space-y-6 p-6">
            <div>
              <span className="label">I am a…</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {GROUPS.map((g) => (
                  <button key={g.id} onClick={() => setGroup(g.id)} aria-pressed={group === g.id}
                    className={`flex gap-3 rounded-2xl border p-3 text-left transition ${group === g.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <g.icon size={20} className={group === g.id ? 'text-brand-600' : 'text-slate-400'} />
                    <span><b className="block text-sm text-slate-800">{g.label}</b><span className="text-xs text-slate-500">{g.desc}</span></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="city">City</label>
                <select id="city" className="input" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                  <option value="">Choose your city…</option>
                  {[...ZONES].sort((a, b) => a.name.localeCompare(b.name)).map((z) => <option key={z.id} value={z.id}>{z.name}, {z.state}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="name">{group === 'schools' ? 'Institution name' : 'Name (optional)'}</label>
                <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={group === 'schools' ? 'e.g. I²IT Hinjewadi' : 'Your name'} />
              </div>
            </div>
            <div>
              <span className="label">Send alerts by</span>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((c) => (
                  <button key={c.id} onClick={() => toggle(c.id)} aria-pressed={channels.includes(c.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${channels.includes(c.id) ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <c.icon size={16} /> {c.label}
                  </button>
                ))}
              </div>
            </div>
            {channels.some((c) => c !== 'push') && (
              <div>
                <label className="label" htmlFor="contact">Phone number or email</label>
                <input id="contact" className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+91 98xxxxxx or name@example.com" />
              </div>
            )}
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" />
              I agree to receive disaster alerts. My contact is used only for alerts and never shown publicly.
            </label>
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
            <button onClick={submit} disabled={busy || !zoneId || !consent} className="btn-primary w-full py-3 text-base">
              {busy && <Loader2 size={18} className="animate-spin" />} Subscribe to alerts
            </button>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-brand-900 p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Preview</p>
              <div className="mt-3 rounded-2xl bg-white p-4 text-slate-800 shadow-xl">
                <p className="flex items-center gap-2 text-xs font-bold text-red-600"><Bell size={14} /> ResQGrid · now</p>
                <p className="mt-1 font-bold">Critical flood risk — {ZONES.find((z) => z.id === zoneId)?.name ?? 'your city'}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {group === 'schools' ? 'Advisory for institutions: suspend classes tomorrow, keep students indoors, follow the evacuation plan.'
                    : group === 'vulnerable' ? 'Priority alert: move to an upper floor now. Help is on the way — call 112 if you need assistance.'
                    : group === 'responders' ? 'Deploy: rescue boats requested near the river bank. Check the Command Center for routes.'
                    : group === 'ngos' ? 'Volunteers needed at the nearest relief camp: food and drinking water distribution.'
                    : 'Move to upper floors or higher ground now. Avoid walking through flood water.'}
                </p>
              </div>
            </div>
            <div className="card p-5 text-sm text-slate-600">
              <p className="font-bold text-brand-900">Why subscribe?</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Alerts reach you even if the app is closed</li>
                <li>English, हिंदी and मराठी</li>
                <li>Schools get closure advisories before parents leave home</li>
                <li>Vulnerable residents are prioritised by responders</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={null}>
      <SubscribeInner />
    </Suspense>
  );
}

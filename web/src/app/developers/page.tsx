'use client';
/** Open data API for NGOs, government agencies and external systems (PPT: "APIs for external systems, data sharing"). */
import { useState } from 'react';
import { Braces, Cpu, Loader2, Play } from 'lucide-react';
import Footer from '@/components/Footer';

const ENDPOINTS: { method: 'GET' | 'POST'; path: string; desc: string; tryable?: boolean }[] = [
  { method: 'GET', path: '/api/state', desc: 'Live risk for every city: hazard scores, category, AI reasons, forecast, city stats.', tryable: true },
  { method: 'GET', path: '/api/alerts?limit=20', desc: 'Latest alerts (automatic and authority broadcasts) with audience and reach.', tryable: true },
  { method: 'GET', path: '/api/official-alerts', desc: 'IMD / NDMA / CWC advisories (adapter, replaceable with live CAP feeds).', tryable: true },
  { method: 'GET', path: '/api/resources', desc: 'Relief camps, hospitals and NDRF teams with live status.', tryable: true },
  { method: 'GET', path: '/api/sensors?zone=mumbai', desc: 'IoT sensor grid: rain gauges, river levels and temperature per city.', tryable: true },
  { method: 'GET', path: '/api/history?minutes=60', desc: 'Risk history snapshots for trend analysis.', tryable: true },
  { method: 'GET', path: '/api/reports', desc: 'Citizen reports (public locations rounded to ~100 m).', tryable: true },
  { method: 'GET', path: '/api/route?fromLat=19.07&fromLng=72.88', desc: 'Risk-aware safe route to the nearest available shelter.', tryable: true },
  { method: 'POST', path: '/api/sensors', desc: 'Ingest a reading from an IoT device (ESP32, LoRa gateway…). River levels feed the risk model.' },
  { method: 'POST', path: '/api/reports', desc: 'Submit a citizen report (multipart: hazard, description, lat, lng, photo).' },
];

export default function DevelopersPage() {
  const [out, setOut] = useState<{ path: string; body: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const tryIt = async (path: string) => {
    setBusy(path);
    try {
      const json = await (await fetch(path, { cache: 'no-store' })).json();
      const text = JSON.stringify(json, null, 2);
      setOut({ path, body: text.length > 6000 ? text.slice(0, 6000) + '\n… (truncated)' : text });
    } catch (e) {
      setOut({ path, body: String(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-10">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-600">Open data</p>
        <h1 className="mt-1 font-display text-4xl font-bold text-brand-900">ResQGrid API for NGOs, agencies &amp; developers</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Every screen in ResQGrid is built on this open JSON API, so disaster-management authorities, NGOs and other apps can use the same live risk data.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <ul className="space-y-2">
            {ENDPOINTS.map((e) => (
              <li key={e.method + e.path} className="card flex items-start gap-3 p-4">
                <span className={`mt-0.5 rounded-md px-2 py-0.5 font-mono text-xs font-bold ${e.method === 'GET' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{e.method}</span>
                <div className="min-w-0 flex-1">
                  <p className="break-all font-mono text-sm font-semibold text-brand-900">{e.path}</p>
                  <p className="text-sm text-slate-600">{e.desc}</p>
                </div>
                {e.tryable && (
                  <button onClick={() => tryIt(e.path)} className="btn-ghost shrink-0 !px-3 !py-1.5 text-xs">
                    {busy === e.path ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Try
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="overflow-hidden rounded-3xl bg-[#0b1220] text-slate-200">
              <p className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-cyan-300"><Braces size={14} /> {out ? out.path : 'Response'}</p>
              <pre className="max-h-[420px] overflow-auto p-4 font-mono text-xs leading-relaxed">{out ? out.body : 'Click "Try" on any GET endpoint to see live data.'}</pre>
            </div>
            <div className="overflow-hidden rounded-3xl bg-[#0b1220] text-slate-200">
              <p className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-cyan-300"><Cpu size={14} /> Connect an IoT river sensor</p>
              <pre className="overflow-auto p-4 font-mono text-xs leading-relaxed">{`curl -X POST http://localhost:3000/api/sensors \\
  -H "content-type: application/json" \\
  -d '{"deviceId":"esp32-mithi-01","zoneId":"mumbai",
       "type":"river","value":4.8}'

# type: rain (mm/hr) | river (m) | temp (°C)
# River above 4 m = warning, 5 m = danger.
# A river reading raises the city's flood risk
# within seconds — watch it on the Command Center.`}</pre>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

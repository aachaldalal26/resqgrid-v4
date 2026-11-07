'use client';
/**
 * Search any place in India (state, district, city, town, village) or use GPS.
 * Monitored cities appear first; every other place comes from /api/places.
 */
import { useEffect, useRef, useState } from 'react';
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react';
import { CATEGORY_COLOR } from '@/lib/risk';
import type { ZoneState } from '@/lib/types';

export type PickedPlace =
  | { kind: 'zone'; zoneId: string; name: string }
  | { kind: 'place'; name: string; district: string; state: string; lat: number; lng: number };

interface PlaceHit { id: string; name: string; district: string; state: string; lat: number; lng: number; type: string; population: number }

export default function PlaceSearch({
  zones, onPick, dark = false, placeholder = 'Search any city, district, village or state in India', locLabel = 'Use my location',
}: { zones: ZoneState[]; onPick: (p: PickedPlace) => void; dark?: boolean; placeholder?: string; locLabel?: string }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Remote search (debounced)
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const id = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q.trim())}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setHits(Array.isArray(json) ? json : []);
        setMsg(null);
      } catch (e) {
        setHits([]);
        setMsg(e instanceof Error ? e.message : 'Search failed');
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  // Close the dropdown when clicking outside
  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const needle = q.trim().toLowerCase();
  const local = needle
    ? zones.filter((z) => z.name.toLowerCase().includes(needle) || z.state.toLowerCase().includes(needle)).slice(0, 5)
    : [];

  const pickZone = (z: ZoneState) => {
    setQ(z.name);
    setOpen(false);
    onPick({ kind: 'zone', zoneId: z.id, name: z.name });
  };
  const pickHit = (h: PlaceHit) => {
    setQ([h.name, h.district, h.state].filter(Boolean).join(', '));
    setOpen(false);
    onPick({ kind: 'place', name: h.name, district: h.district, state: h.state, lat: h.lat, lng: h.lng });
  };

  const locate = () => {
    setMsg(null);
    if (!navigator.geolocation) return setMsg('This browser cannot share location.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        let place = { name: 'My location', district: '', state: '' };
        try {
          place = await (await fetch(`/api/places/reverse?lat=${lat}&lng=${lng}`)).json();
        } catch {
          /* keep "My location" */
        }
        setLocating(false);
        setQ([place.name, place.district, place.state].filter(Boolean).join(', '));
        onPick({ kind: 'place', name: place.name, district: place.district, state: place.state, lat, lng });
      },
      (err) => {
        setLocating(false);
        setMsg(
          err.code === 1
            ? 'Location is blocked. Click the location icon in Chrome\'s address bar → Allow. On Mac also turn on: System Settings → Privacy & Security → Location Services → Google Chrome.'
            : 'Could not get your location (no GPS/Wi-Fi fix). Try again or search your village/city instead.',
        );
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };

  const shell = dark
    ? 'border-white/15 bg-white/[.06] text-white focus-within:border-cyan-400/60'
    : 'border-slate-200 bg-white text-slate-800 focus-within:border-brand-500';
  const menu = dark ? 'border-white/10 bg-[#0b1530] text-white' : 'border-slate-200 bg-white text-slate-800';
  const sub = dark ? 'text-slate-400' : 'text-slate-500';
  const hover = dark ? 'hover:bg-white/5' : 'hover:bg-slate-50';

  return (
    <div ref={box} className="relative">
      <div className={`flex items-center gap-2 rounded-2xl border p-2 backdrop-blur ${shell}`}>
        <Search size={20} className={`ml-2 shrink-0 ${dark ? 'text-cyan-300' : 'text-brand-500'}`} />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (local[0]) pickZone(local[0]);
              else if (hits[0]) pickHit(hits[0]);
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className={`min-w-0 flex-1 bg-transparent py-2 text-base focus:outline-none ${dark ? 'placeholder:text-slate-400' : 'placeholder:text-slate-400'}`}
        />
        {busy && <Loader2 size={16} className={`animate-spin ${sub}`} />}
        <button onClick={locate} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold ${dark ? 'bg-cyan-400 text-[#050b1c] hover:bg-cyan-300' : 'bg-brand-500 text-white hover:bg-brand-600'}`}>
          {locating ? <Loader2 size={16} className="animate-spin" /> : <Crosshair size={16} />}
          <span className="hidden sm:inline">{locLabel}</span>
        </button>
      </div>

      {msg && <p className={`mt-2 rounded-xl px-3 py-2 text-xs ${dark ? 'bg-amber-400/15 text-amber-200' : 'bg-amber-50 text-amber-800'}`}>{msg}</p>}

      {open && (local.length > 0 || hits.length > 0) && (
        <div className={`absolute z-[1200] mt-2 max-h-[360px] w-full overflow-y-auto rounded-2xl border shadow-2xl ${menu}`}>
          {local.length > 0 && (
            <>
              <p className={`px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest ${sub}`}>Monitored cities · live</p>
              {local.map((z) => (
                <button key={z.id} onClick={() => pickZone(z)} className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${hover}`}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLOR[z.risk.category] }} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{z.name}<span className={`ml-2 text-xs font-normal ${sub}`}>{z.state}</span></span>
                  <span className="font-mono text-sm">{z.risk.overall}</span>
                </button>
              ))}
            </>
          )}
          {hits.length > 0 && (
            <>
              <p className={`px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest ${sub}`}>All places in India</p>
              {hits.map((h) => (
                <button key={h.id} onClick={() => pickHit(h)} className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${hover}`}>
                  <MapPin size={15} className={`shrink-0 ${sub}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{h.name}</span>
                    <span className={`block truncate text-xs ${sub}`}>{[h.district, h.state].filter(Boolean).join(', ')}</span>
                  </span>
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${dark ? 'bg-white/10' : 'bg-slate-100'}`}>{h.type}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

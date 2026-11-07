'use client';
import { useRef, useState } from 'react';
import { Camera, CheckCircle2, Crosshair, Loader2, Send } from 'lucide-react';
import MapView from '@/components/MapView';
import { useI18n } from '@/i18n/I18nProvider';
import { useLiveState } from '@/hooks/usePoll';
import type { Report, ReportHazard } from '@/lib/types';

const TYPES: { id: ReportHazard; emoji: string }[] = [
  { id: 'flood', emoji: '🌊' },
  { id: 'landslide', emoji: '⛰️' },
  { id: 'storm', emoji: '🌪️' },
  { id: 'heatwave', emoji: '🔥' },
  { id: 'fire', emoji: '🚒' },
  { id: 'other', emoji: '⚠️' },
];

/** Shrinks big phone photos to max 1280 px JPEG before upload. */
async function compress(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}

export default function ReportPage() {
  const { t } = useI18n();
  const { data } = useLiveState(10000);
  const [hazard, setHazard] = useState<ReportHazard>('flood');
  const [desc, setDesc] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Report | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const useGps = () => {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setPos([p.coords.latitude, p.coords.longitude]);
        setLocating(false);
      },
      () => {
        setError('Could not get GPS location — tap on the map instead.');
        setLocating(false);
      },
      { timeout: 8000, enableHighAccuracy: true },
    );
  };

  const submit = async () => {
    if (!pos) return setError(t('report.needLocation'));
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append('hazard', hazard);
    fd.append('description', desc);
    fd.append('lat', String(pos[0]));
    fd.append('lng', String(pos[1]));
    if (photo) fd.append('photo', await compress(photo), 'photo.jpg');
    try {
      const res = await fetch('/api/reports', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setResult(null);
    setDesc('');
    setPhoto(null);
    setPreview(null);
  };

  if (result) {
    const pct = Math.round(result.verificationScore * 100);
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <div className="card p-8 text-center">
          <CheckCircle2 className="mx-auto text-emerald-500" size={56} />
          <h1 className="mt-3 font-display text-2xl font-bold text-brand-900">{t('report.success')}</h1>
          <p className="mt-1 text-sm text-slate-500">{result.zoneName}</p>
          <div className="mt-6 space-y-3 text-left text-sm">
            {result.aiLabel && (
              <div className="flex justify-between rounded-xl bg-slate-50 p-3">
                <span className="font-semibold text-slate-600">{t('report.ai')}</span>
                <span className="font-bold text-brand-900">
                  {t(`hazard.${result.aiLabel}`) === `hazard.${result.aiLabel}` ? result.aiLabel : t(`hazard.${result.aiLabel}`)} · {Math.round((result.aiConfidence ?? 0) * 100)}%
                  <span className="ml-1 text-xs font-normal text-slate-500">({result.aiMethod})</span>
                </span>
              </div>
            )}
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-600">{t('report.verification')}</span>
                <span className="font-mono font-bold">{pct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="flex justify-between rounded-xl bg-slate-50 p-3">
              <span className="font-semibold text-slate-600">{t('report.statusLabel')}</span>
              <span className={`font-bold ${result.status === 'verified' ? 'text-emerald-600' : 'text-amber-600'}`}>{t(`report.${result.status}`)}</span>
            </div>
          </div>
          <button onClick={reset} className="btn-primary mt-6 w-full">{t('report.another')}</button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-2">
      <section>
        <h1 className="font-display text-3xl font-bold text-brand-900">{t('report.title')}</h1>
        <p className="mt-1 text-slate-600">{t('report.subtitle')}</p>

        <div className="card mt-6 space-y-5 p-5">
          <div>
            <span className="label">{t('report.type')}</span>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setHazard(h.id)}
                  aria-pressed={hazard === h.id}
                  className={`rounded-xl border p-3 text-center text-sm font-semibold transition ${hazard === h.id ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-100' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <span className="block text-2xl">{h.emoji}</span>
                  {t(`hazard.${h.id}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="desc">{t('report.description')}</label>
            <textarea id="desc" rows={3} className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('report.descPh')} maxLength={1000} />
          </div>

          <div>
            <span className="label">{t('report.photo')}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setPhoto(f);
                setPreview(f ? URL.createObjectURL(f) : null);
              }}
            />
            <button onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-4 text-left hover:border-brand-500 hover:bg-brand-50/40">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Selected" className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-lg bg-slate-100 text-slate-500"><Camera /></span>
              )}
              <span className="text-sm text-slate-600">
                <b className="block text-slate-800">{photo ? photo.name : t('report.photo')}</b>
                {t('report.photoHint')}
              </span>
            </button>
          </div>

          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          <button onClick={submit} disabled={busy} className="btn-primary w-full py-3 text-base">
            {busy ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            {busy ? t('report.submitting') : t('report.submit')}
          </button>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="label !mb-0">{t('report.location')}</span>
          <button onClick={useGps} className="btn-ghost !py-1.5 text-xs">
            {locating ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />} {t('report.useGps')}
          </button>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          {t('report.pickMap')}
          {pos && <span className="ml-2 font-mono text-slate-700">{pos[0].toFixed(4)}, {pos[1].toFixed(4)}</span>}
        </p>
        <div className="card h-[460px] overflow-hidden">
          <MapView zones={data?.zones ?? []} pin={pos} onMapClick={setPos} focus={pos} focusZoom={13} />
        </div>
      </section>
    </main>
  );
}

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { mlPost } from '@/lib/ml';
import { getLiveState, invalidateLiveState } from '@/lib/engine';
import { findZone } from '@/data/zones';
import { haversineKm, roundCoord } from '@/lib/geo';
import { isAuthority } from '@/lib/auth';
import type { Hazard, Report, ReportHazard } from '@/lib/types';

export const dynamic = 'force-dynamic';
const HAZARDS: ReportHazard[] = ['flood', 'landslide', 'heatwave', 'storm', 'fire', 'other'];
const MAX_PHOTO = 8 * 1024 * 1024;

/** Public view rounds locations to ~100 m; authorities see exact coordinates. */
export async function GET() {
  const reports = await getStore().listReports();
  if (isAuthority()) return NextResponse.json(reports);
  return NextResponse.json(
    reports.filter((r) => r.status !== 'rejected').map((r) => ({ ...r, lat: roundCoord(r.lat), lng: roundCoord(r.lng) })),
  );
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }
  const hazard = String(form.get('hazard') || '') as ReportHazard;
  const lat = Number(form.get('lat'));
  const lng = Number(form.get('lng'));
  const description = String(form.get('description') || '').trim().slice(0, 1000);
  if (!HAZARDS.includes(hazard)) return NextResponse.json({ error: 'Invalid hazard type' }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: 'Location is required' }, { status: 400 });

  const store = getStore();
  const id = randomUUID();
  let photoUrl: string | null = null;
  let ai: { label: string; confidence: number; method: string } | null = null;

  const file = form.get('photo');
  if (file && typeof file !== 'string' && file.size > 0) {
    if (file.size > MAX_PHOTO) return NextResponse.json({ error: 'Photo too large (max 8 MB)' }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    photoUrl = await store.savePhoto(id, buf, file.type || 'image/jpeg');
    // First CLIP call can take ~30-60 s while the model downloads, so allow a long timeout.
    ai = await mlPost('/classify-report', { image_base64: buf.toString('base64') }, 90_000, false);
  }

  const zone = findZone(lat, lng);
  const state = await getLiveState();
  const zs = zone ? state.zones.find((z) => z.id === zone.id) : undefined;
  const existing = await store.listReports();
  const nearby = existing.filter(
    (r) => r.hazard === hazard && r.status !== 'rejected' && Date.now() - Date.parse(r.createdAt) < 6 * 3600_000 &&
      haversineKm([r.lat, r.lng], [lat, lng]) < 1.5,
  ).length;

  // Verification score = 50% image AI + 30% nearby similar reports + 20% agreement with sensor risk
  const imgScore = ai ? (ai.label === hazard ? ai.confidence : ai.label === 'normal' ? 0 : ai.confidence * 0.3) : photoUrl ? 0.25 : 0.15;
  const sensor = zs && hazard in zs.risk.scores ? zs.risk.scores[hazard as Hazard] / 100 : 0.2;
  const verificationScore = Math.round((0.5 * imgScore + 0.3 * Math.min(1, nearby / 3) + 0.2 * sensor) * 100) / 100;

  const report: Report = {
    id, hazard, description, lat, lng,
    zoneId: zone?.id ?? null, zoneName: zone?.name ?? 'Outside monitored zones',
    photoUrl, aiLabel: ai?.label ?? null, aiConfidence: ai?.confidence ?? null, aiMethod: ai?.method ?? null,
    verificationScore, status: verificationScore >= 0.6 ? 'verified' : 'pending', createdAt: new Date().toISOString(),
  };
  await store.addReport(report);
  invalidateLiveState();
  return NextResponse.json(report, { status: 201 });
}

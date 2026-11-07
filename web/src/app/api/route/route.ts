import { NextRequest, NextResponse } from 'next/server';
import { getLiveState } from '@/lib/engine';
import { getStore } from '@/lib/store';
import { safeRoute } from '@/lib/routing';
import { findZone } from '@/data/zones';
import { haversineKm } from '@/lib/geo';
import { CATEGORY_RANK } from '@/lib/risk';

export const dynamic = 'force-dynamic';

/**
 * GET /api/route?fromLat=..&fromLng=..[&toLat=..&toLng=..]
 * Without a destination, picks the nearest shelter that is not full and not in a High/Critical zone.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const fromLat = Number(q.get('fromLat'));
  const fromLng = Number(q.get('fromLng'));
  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLng)) return NextResponse.json({ error: 'fromLat/fromLng required' }, { status: 400 });

  const state = await getLiveState();
  let to: [number, number] | null = null;
  let toName = 'Destination';
  if (q.get('toLat') && q.get('toLng')) {
    to = [Number(q.get('toLat')), Number(q.get('toLng'))];
  } else {
    const all = (await getStore().listResources()).filter((r) => r.type === 'shelter' && r.status !== 'full');
    // Only shelters reachable by road in an emergency (within 80 km)
    const near = all.filter((r) => haversineKm([fromLat, fromLng], [r.lat, r.lng]) <= 80);
    const shelters = near.length ? near : all;
    const safe = shelters.filter((s) => {
      const z = findZone(s.lat, s.lng);
      const zs = z && state.zones.find((x) => x.id === z.id);
      return !zs || CATEGORY_RANK[zs.risk.category] < 2;
    });
    const pool = safe.length ? safe : shelters;
    const best = pool.sort((a, b) => haversineKm([fromLat, fromLng], [a.lat, a.lng]) - haversineKm([fromLat, fromLng], [b.lat, b.lng]))[0];
    if (!best) return NextResponse.json({ error: 'No shelter available' }, { status: 404 });
    to = [best.lat, best.lng];
    toName = best.name;
  }
  const route = safeRoute([fromLat, fromLng], to, state.zones);
  if (!route) return NextResponse.json({ error: 'No route found' }, { status: 404 });
  return NextResponse.json({ ...route, to, toName });
}

import { NextRequest, NextResponse } from 'next/server';
import { placeRisk } from '@/lib/place';

export const dynamic = 'force-dynamic';

/** Live AI risk for any point in India. GET /api/place-risk?lat=..&lng=..&name=..&state=..&district=.. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const lat = Number(q.get('lat'));
  const lng = Number(q.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 5 || lat > 38 || lng < 67 || lng > 99) {
    return NextResponse.json({ error: 'Point must be inside India' }, { status: 400 });
  }
  try {
    return NextResponse.json(await placeRisk(lat, lng, (q.get('name') || 'Selected place').slice(0, 80), q.get('state') || '', q.get('district') || ''));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

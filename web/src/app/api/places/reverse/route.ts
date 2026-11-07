import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GPS → place name (village / town / city, district, state) using OpenStreetMap Nominatim (free, no key).
 * GET /api/places/reverse?lat=21.15&lng=79.09
 */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lng = Number(req.nextUrl.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
  const fallback = { name: 'My location', district: '', state: '', lat, lng };
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&accept-language=en`, {
      headers: { 'User-Agent': 'ResQGrid/1.0 (PCCOE Grand Challenge disaster early-warning prototype)' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json(fallback);
    const j = await res.json();
    const a = j.address ?? {};
    return NextResponse.json({
      name: a.village || a.town || a.city || a.suburb || a.hamlet || a.municipality || a.county || 'My location',
      district: a.state_district || a.county || '',
      state: a.state || '',
      lat,
      lng,
    });
  } catch {
    return NextResponse.json(fallback);
  }
}

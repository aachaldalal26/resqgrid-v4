import { NextRequest, NextResponse } from 'next/server';
import { getJson } from '@/lib/weather';

export const dynamic = 'force-dynamic';

export interface PlaceHit { id: string; name: string; district: string; state: string; lat: number; lng: number; type: string; population: number }

const TYPE: Record<string, string> = {
  PPLC: 'Capital', PPLA: 'State capital', PPLA2: 'District HQ', PPLA3: 'Taluka HQ', PPLA4: 'Town', PPL: 'Town / village',
  PPLX: 'Locality', PPLL: 'Village', ADM1: 'State', ADM2: 'District', ADM3: 'Taluka',
};
const cache = new Map<string, { at: number; hits: PlaceHit[] }>();

/**
 * Search ANY place in India — states, districts, cities, towns, villages, localities.
 * Uses the free Open-Meteo geocoding service (GeoNames data, no API key).
 * GET /api/places?q=Wardha
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json([]);
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3600_000) return NextResponse.json(hit.hits);
  try {
    const json = await getJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=12&language=en&format=json&countryCode=IN`,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hits: PlaceHit[] = (json.results ?? []).map((r: any) => ({
      id: String(r.id),
      name: r.name,
      district: r.admin2 ?? r.admin3 ?? '',
      state: r.admin1 ?? '',
      lat: r.latitude,
      lng: r.longitude,
      type: TYPE[r.feature_code] ?? 'Place',
      population: r.population ?? 0,
    }));
    cache.set(key, { at: Date.now(), hits });
    return NextResponse.json(hits);
  } catch (e) {
    return NextResponse.json({ error: 'Place search needs internet', detail: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

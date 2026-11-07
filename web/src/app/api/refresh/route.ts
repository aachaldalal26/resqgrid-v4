import { NextRequest, NextResponse } from 'next/server';
import { getWeather } from '@/lib/weather';
import { getLiveState } from '@/lib/engine';

export const dynamic = 'force-dynamic';

/** Cron route: force-refresh weather + risk (every 10 min via vercel.json or any cron service). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}` && req.nextUrl.searchParams.get('key') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const w = await getWeather(true);
  const s = await getLiveState(true);
  return NextResponse.json({ weather: { source: w.source, delayed: w.delayed, error: w.error }, city: s.city, updatedAt: s.updatedAt });
}

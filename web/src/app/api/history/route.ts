import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Risk snapshots for trend charts. ?minutes=60 */
export async function GET(req: NextRequest) {
  const minutes = Math.min(24 * 60, Number(req.nextUrl.searchParams.get('minutes')) || 60);
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  return NextResponse.json(await getStore().listSnapshots(since));
}

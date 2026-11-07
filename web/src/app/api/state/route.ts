import { NextResponse } from 'next/server';
import { getLiveState } from '@/lib/engine';

export const dynamic = 'force-dynamic';

/** Live risk for every zone (polled by the map and dashboard every few seconds). */
export async function GET() {
  try {
    return NextResponse.json(await getLiveState());
  } catch (e) {
    console.error('[state]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

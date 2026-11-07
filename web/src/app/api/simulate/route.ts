import { NextRequest, NextResponse } from 'next/server';
import { getSim, setSim } from '@/lib/engine';
import { SCENARIOS } from '@/lib/scenarios';
import type { ScenarioId } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ sim: await getSim(), scenarios: SCENARIOS });
}

/** Body: {"scenario": "monsoon-flood" | "heatwave" | "ghat-landslide" | null} */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const id = b.scenario as ScenarioId | null;
  if (id !== null && !SCENARIOS.some((s) => s.id === id)) return NextResponse.json({ error: 'Unknown scenario' }, { status: 400 });
  return NextResponse.json({ sim: await setSim(id ?? null) });
}

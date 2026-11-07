import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { isAuthority } from '@/lib/auth';
import { ZONES } from '@/data/zones';
import type { Alert, Audience, Category } from '@/lib/types';
import { AUDIENCES, computeReach } from '@/lib/audience';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limit = Math.min(200, Number(req.nextUrl.searchParams.get('limit')) || 50);
  return NextResponse.json(await getStore().listAlerts(limit));
}

/** Authority broadcast alert. */
export async function POST(req: NextRequest) {
  if (!isAuthority()) return NextResponse.json({ error: 'Authority login required' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const zone = ZONES.find((z) => z.id === b.zoneId) ?? null;
  const category: Category = ['Low', 'Moderate', 'High', 'Critical'].includes(b.category) ? b.category : 'High';
  const message = String(b.message || '').trim().slice(0, 600);
  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  const audience: Audience = AUDIENCES.some((a) => a.id === b.audience) ? b.audience : 'all';
  const alert: Alert = {
    id: randomUUID(),
    zoneId: zone?.id ?? null,
    zoneName: zone?.name ?? 'All of India',
    hazard: b.hazard || 'general',
    category,
    title: String(b.title || `${category} alert — ${zone?.name ?? 'All of India'}`).slice(0, 140),
    message,
    source: 'authority',
    createdAt: new Date().toISOString(),
    audience,
    reach: await computeReach(zone?.id ?? null, audience),
  };
  await getStore().addAlert(alert);
  return NextResponse.json(alert, { status: 201 });
}

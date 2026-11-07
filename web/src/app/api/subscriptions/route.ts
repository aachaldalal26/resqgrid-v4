import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { AUDIENCES, addSubscription, listSubscriptions } from '@/lib/audience';
import { ZONES } from '@/data/zones';
import type { Channel, Subscription } from '@/lib/types';

export const dynamic = 'force-dynamic';
const CHANNELS: Channel[] = ['push', 'sms', 'email', 'whatsapp'];

/** Aggregated counts only — contact details are never returned. */
export async function GET() {
  const subs = await listSubscriptions();
  const byGroup: Record<string, number> = {};
  const byZone: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  for (const s of subs) {
    byGroup[s.group] = (byGroup[s.group] ?? 0) + 1;
    byZone[s.zoneId] = (byZone[s.zoneId] ?? 0) + 1;
    for (const c of s.channels) byChannel[c] = (byChannel[c] ?? 0) + 1;
  }
  return NextResponse.json({ total: subs.length, byGroup, byZone, byChannel });
}

/** Body: {name?, zoneId, group, channels[], contact?} */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const zone = ZONES.find((z) => z.id === b.zoneId);
  if (!zone) return NextResponse.json({ error: 'Choose your city' }, { status: 400 });
  const group = AUDIENCES.find((a) => a.id === b.group)?.id ?? 'residents';
  const channels = (Array.isArray(b.channels) ? b.channels : []).filter((c: Channel) => CHANNELS.includes(c)) as Channel[];
  if (!channels.length) return NextResponse.json({ error: 'Pick at least one channel' }, { status: 400 });
  const contact = String(b.contact || '').trim().slice(0, 120);
  if ((channels.includes('sms') || channels.includes('whatsapp') || channels.includes('email')) && !contact) {
    return NextResponse.json({ error: 'Enter a phone number or email for SMS / WhatsApp / email alerts' }, { status: 400 });
  }
  const sub: Subscription = {
    id: randomUUID(),
    name: String(b.name || '').trim().slice(0, 80),
    zoneId: zone.id,
    group,
    channels,
    contact,
    createdAt: new Date().toISOString(),
  };
  await addSubscription(sub);
  return NextResponse.json({ id: sub.id, zoneId: sub.zoneId, zoneName: zone.name, group: sub.group, channels: sub.channels }, { status: 201 });
}

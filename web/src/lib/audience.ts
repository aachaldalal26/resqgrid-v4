/** Alert subscriptions (citizens, schools & colleges, vulnerable groups, responders, NGOs) and reach counting. */
import { getStore } from './store';
import type { Audience, Channel, Reach, Subscription } from './types';

export const AUDIENCES: { id: Exclude<Audience, 'all'>; label: string }[] = [
  { id: 'residents', label: 'Residents' },
  { id: 'schools', label: 'Schools & colleges' },
  { id: 'vulnerable', label: 'Vulnerable communities' },
  { id: 'responders', label: 'Emergency responders' },
  { id: 'ngos', label: 'NGOs & volunteers' },
];

export async function listSubscriptions(): Promise<Subscription[]> {
  return (await getStore().getState<Subscription[]>('subscriptions')) ?? [];
}

export async function addSubscription(s: Subscription) {
  const list = await listSubscriptions();
  list.push(s);
  await getStore().setState('subscriptions', list.slice(-5000));
}

/** Count who an alert reaches. zoneId null = all of India. */
export async function computeReach(zoneId: string | null, audience: Audience = 'all'): Promise<Reach> {
  const subs = (await listSubscriptions()).filter(
    (s) => (zoneId === null || s.zoneId === zoneId) && (audience === 'all' || s.group === audience),
  );
  const channels: Partial<Record<Channel, number>> = {};
  for (const s of subs) for (const c of s.channels) channels[c] = (channels[c] ?? 0) + 1;
  return { subscribers: subs.length, channels };
}

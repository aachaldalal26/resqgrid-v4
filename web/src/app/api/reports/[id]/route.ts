import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { isAuthority } from '@/lib/auth';
import { invalidateLiveState } from '@/lib/engine';

export const dynamic = 'force-dynamic';

/** Authority triage: verify / reject / reopen a citizen report. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthority()) return NextResponse.json({ error: 'Authority login required' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const status = body.status;
  if (!['pending', 'verified', 'rejected'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  const r = await getStore().updateReport(params.id, { status });
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  invalidateLiveState();
  return NextResponse.json(r);
}

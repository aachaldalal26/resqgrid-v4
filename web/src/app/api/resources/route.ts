import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { isAuthority } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getStore().listResources());
}

/** Body: {"id": "...", "status"?: "available|busy|full|deployed", "occupied"?: number} */
export async function PATCH(req: NextRequest) {
  if (!isAuthority()) return NextResponse.json({ error: 'Authority login required' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (['available', 'busy', 'full', 'deployed'].includes(b.status)) patch.status = b.status;
  if (Number.isFinite(b.occupied)) patch.occupied = Math.max(0, Math.round(b.occupied));
  const r = await getStore().updateResource(String(b.id), patch);
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(r);
}

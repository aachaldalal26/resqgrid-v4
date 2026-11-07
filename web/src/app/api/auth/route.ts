import { NextRequest, NextResponse } from 'next/server';
import { ROLE_COOKIE, getRole, signRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ role: getRole() });
}

/** Body: {"role": "citizen"} or {"role": "authority", "code": "..."} */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  if (b.role === 'authority' && b.code !== (process.env.AUTHORITY_CODE || 'resq2026')) {
    return NextResponse.json({ error: 'Wrong authority access code' }, { status: 401 });
  }
  const role = b.role === 'authority' ? 'authority' : 'citizen';
  const res = NextResponse.json({ role });
  res.cookies.set(ROLE_COOKIE, signRole(role), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12 });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ROLE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

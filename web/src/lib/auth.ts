/**
 * Simple role-based demo login. The role cookie is HMAC-signed so it cannot be forged.
 * (Swap for Supabase Auth email login in production - the profiles table is ready.)
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import type { Role } from './types';

export const ROLE_COOKIE = 'rq_role';
const secret = () => process.env.AUTH_SECRET || 'resqgrid-dev-secret';

export function signRole(role: Role) {
  const sig = createHmac('sha256', secret()).update(role).digest('hex').slice(0, 32);
  return `${role}.${sig}`;
}

export function verifyRole(value: string | undefined): Role | null {
  if (!value) return null;
  const [role] = value.split('.');
  if (role !== 'citizen' && role !== 'authority') return null;
  const expected = signRole(role);
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? role : null;
}

export function getRole(): Role | null {
  return verifyRole(cookies().get(ROLE_COOKIE)?.value);
}

export function isAuthority() {
  return getRole() === 'authority';
}

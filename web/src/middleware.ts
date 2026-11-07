import { NextResponse, type NextRequest } from 'next/server';

/** Sends visitors without an authority session to /login before the Command Center. */
export function middleware(req: NextRequest) {
  const role = req.cookies.get('rq_role')?.value ?? '';
  if (!role.startsWith('authority.')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', '/dashboard');
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*'] };

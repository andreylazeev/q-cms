import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware that protects the dashboard area.
 *
 * Auth is currently tracked via the `qcms_token` cookie (or the
 * `qcms-auth` localStorage sentinel when running client-side).
 * In production the cookie is set by the real `@q-cms/api-client`
 * after `auth.login`. In dev we accept any non-empty value so the
 * admin app can be iterated on without the API.
 */
const PUBLIC_PATHS: readonly string[] = ['/login', '/api/health'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/favicon')) return true;
  if (pathname.startsWith('/static')) return true;
  // Public assets served from /public/media — allow unauthenticated
  // access so images load inside authenticated pages.
  if (pathname.startsWith('/media')) return true;
  return false;
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) {
    return NextResponse.next();
  }
  const token = request.cookies.get('qcms_token')?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|media).*)',
  ],
};

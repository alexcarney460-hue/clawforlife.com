import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Route Configuration
// ---------------------------------------------------------------------------

/** Routes that require authentication. */
const PROTECTED_ROUTES = ['/orders', '/account', '/api/auth/me', '/api/auth/device'];

/** Routes that require admin role. */
const ADMIN_ROUTES = ['/admin'];

/** Routes that should redirect to / if already authenticated. */
const AUTH_ROUTES = ['/login', '/register', '/reset-password'];

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Next.js middleware for auth-based route protection.
 *
 * - Protected routes redirect to /login if no valid JWT.
 * - Admin routes redirect to /login if user is not admin.
 * - Auth routes (login/register) redirect to / if already authenticated.
 * - All other routes pass through.
 */
export async function authMiddleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isAdmin = ADMIN_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  // No auth check needed for public routes
  if (!isProtected && !isAdmin && !isAuthRoute) {
    return NextResponse.next();
  }

  // Extract token from Authorization header or cookie
  const token = extractTokenFromRequest(request);

  // Validate the token if present
  const user = token ? await validateToken(token) : null;

  // Auth routes: redirect authenticated users away
  if (isAuthRoute) {
    if (user) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Protected routes: require authentication
  if (isProtected && !user) {
    return redirectToLogin(request);
  }

  // Admin routes: require admin role
  if (isAdmin) {
    if (!user) {
      return redirectToLogin(request);
    }

    const isAdminUser = await checkAdminRole(user.id);
    if (!isAdminUser) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTokenFromRequest(request: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Fall back to cookie-based session (Supabase stores tokens in cookies)
  const accessToken = request.cookies.get('sb-access-token')?.value;
  if (accessToken) {
    return accessToken;
  }

  return null;
}

interface MinimalUser {
  id: string;
  email: string;
}

async function validateToken(token: string): Promise<MinimalUser | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }

    return { id: data.user.id, email: data.user.email! };
  } catch {
    return null;
  }
}

async function checkAdminRole(userId: string): Promise<boolean> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return false;
    }

    return (data as { role: string }).role === 'admin';
  } catch {
    return false;
  }
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

// ---------------------------------------------------------------------------
// Matcher config (export for use in src/middleware.ts)
// ---------------------------------------------------------------------------

export const AUTH_MIDDLEWARE_MATCHER = [
  '/orders/:path*',
  '/account/:path*',
  '/admin/:path*',
  '/login',
  '/register',
  '/reset-password',
  '/api/auth/me',
  '/api/auth/device',
];

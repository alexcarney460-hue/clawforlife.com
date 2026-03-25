import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string;
  };
}

export interface AuthResult {
  user: { id: string; email: string };
  profile: Profile;
}

// ---------------------------------------------------------------------------
// Token Extraction
// ---------------------------------------------------------------------------

/**
 * Extract the Bearer token from the Authorization header.
 * Returns null if no valid token is found.
 */
async function extractToken(): Promise<string | null> {
  const headerStore = await headers();
  const authHeader = headerStore.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

// ---------------------------------------------------------------------------
// Session Helpers
// ---------------------------------------------------------------------------

/**
 * Get the current session from the Authorization header.
 * Returns null if no valid session exists (does NOT throw).
 */
export async function getSession(): Promise<Session | null> {
  const token = await extractToken();
  if (!token) {
    return null;
  }

  const supabase = createServerClient(token);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return {
    access_token: token,
    refresh_token: '',
    expires_at: 0,
    user: {
      id: data.user.id,
      email: data.user.email!,
    },
  };
}

/**
 * Get the current authenticated user's profile.
 * Returns null if not authenticated or profile doesn't exist.
 */
export async function getCurrentUser(): Promise<Profile | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

/**
 * Require an authenticated user. Returns { user, profile } or throws a
 * redirect to /login (for server components) or returns a 401 indicator.
 *
 * For API routes, catch the redirect and return NextResponse with 401.
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const supabase = createServiceRoleClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    redirect('/login');
  }

  return {
    user: session.user,
    profile: profile as Profile,
  };
}

/**
 * Require an admin user. Returns { user, profile } or throws a redirect.
 * Checks profile.role === 'admin'.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const auth = await requireAuth();

  if (auth.profile.role !== 'admin') {
    redirect('/login');
  }

  return auth;
}

// ---------------------------------------------------------------------------
// API-route-friendly variants (return null instead of redirecting)
// ---------------------------------------------------------------------------

/**
 * Like requireAuth but returns null instead of redirecting.
 * Designed for API route handlers that need to return JSON errors.
 */
export async function getAuthOrNull(): Promise<AuthResult | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const supabase = createServiceRoleClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    return null;
  }

  return {
    user: session.user,
    profile: profile as Profile,
  };
}

/**
 * Like requireAdmin but returns null instead of redirecting.
 * Designed for API route handlers that need to return JSON errors.
 */
export async function getAdminOrNull(): Promise<AuthResult | null> {
  const auth = await getAuthOrNull();
  if (!auth) {
    return null;
  }

  if (auth.profile.role !== 'admin') {
    return null;
  }

  return auth;
}

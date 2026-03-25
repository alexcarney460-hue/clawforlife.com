import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Database, Profile } from '@/lib/types';

// ---------------------------------------------------------------------------
// POST /api/auth/login
// Body: { email, password }
// Response: { user: Profile, session: Session } | { error: string }
// ---------------------------------------------------------------------------

interface LoginBody {
  email: string;
  password: string;
}

function validateBody(body: unknown): body is LoginBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.email === 'string' &&
    b.email.length > 0 &&
    typeof b.password === 'string' &&
    b.password.length > 0
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();

    if (!validateBody(body)) {
      return NextResponse.json(
        { error: 'Invalid request. Required: email, password.' },
        { status: 400 }
      );
    }

    const { email, password } = body;
    const normalizedEmail = email.toLowerCase().trim();

    // Use a fresh client for sign-in (not the service role client).
    // Supabase auth.signInWithPassword needs the anon key.
    const authClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: signInData, error: signInError } =
      await authClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    if (signInError || !signInData.session || !signInData.user) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    // Fetch the profile using service role (bypasses RLS)
    const supabase = createServiceRoleClient();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', signInData.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: profile as Profile,
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        expires_at: signInData.session.expires_at,
        user: {
          id: signInData.user.id,
          email: signInData.user.email!,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

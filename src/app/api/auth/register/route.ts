import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Profile, ProfileInsert } from '@/lib/types';

// ---------------------------------------------------------------------------
// POST /api/auth/register
// Body: { email, password, full_name, phone? }
// Response: { user: Profile } | { error: string }
// ---------------------------------------------------------------------------

interface RegisterBody {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

function validateBody(body: unknown): body is RegisterBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.email === 'string' &&
    b.email.length > 0 &&
    typeof b.password === 'string' &&
    b.password.length >= 8 &&
    typeof b.full_name === 'string' &&
    b.full_name.length > 0
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();

    if (!validateBody(body)) {
      return NextResponse.json(
        { error: 'Invalid request. Required: email, password (8+ chars), full_name.' },
        { status: 400 }
      );
    }

    const { email, password, full_name, phone } = body;
    const normalizedEmail = email.toLowerCase().trim();

    const supabase = createServiceRoleClient();

    // 1. Create auth user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    });

    if (authError) {
      // Handle duplicate email
      if (authError.message?.includes('already registered') || authError.message?.includes('duplicate')) {
        return NextResponse.json(
          { error: 'An account with this email already exists.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user account.' },
        { status: 500 }
      );
    }

    // 2. Create profile row
    // Note: The DB trigger should auto-set role to 'admin' for gardenablaze@gmail.com.
    // We set 'customer' as the default here; the trigger overrides if applicable.
    const profileInsert: ProfileInsert = {
      id: authData.user.id,
      email: normalizedEmail,
      full_name,
      phone: phone ?? null,
      role: 'customer',
    };

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert(profileInsert)
      .select()
      .single();

    if (profileError) {
      // If profile creation fails, clean up the auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Failed to create user profile.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { user: profile as Profile },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

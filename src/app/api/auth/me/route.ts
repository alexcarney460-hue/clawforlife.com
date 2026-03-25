import { NextResponse } from 'next/server';
import { getAuthOrNull } from '@/lib/auth/session';

// ---------------------------------------------------------------------------
// GET /api/auth/me
// Headers: Authorization: Bearer <jwt>
// Response: { user: Profile } | { error: string }
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await getAuthOrNull();

    if (!auth) {
      return NextResponse.json(
        { error: 'Not authenticated.' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user: auth.profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

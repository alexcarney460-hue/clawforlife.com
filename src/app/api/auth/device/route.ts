import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrNull } from '@/lib/auth/session';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Device, DeviceInsert } from '@/lib/types';

// ---------------------------------------------------------------------------
// POST /api/auth/device
// Headers: Authorization: Bearer <jwt>
// Body: { device_token, phone_model?, openclaw_version? }
// Response: { device: Device }
// ---------------------------------------------------------------------------

interface RegisterDeviceBody {
  device_token: string;
  phone_model?: string;
  openclaw_version?: string;
}

function validateBody(body: unknown): body is RegisterDeviceBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.device_token === 'string' && b.device_token.length > 0;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await getAuthOrNull();
    if (!auth) {
      return NextResponse.json(
        { error: 'Not authenticated.' },
        { status: 401 }
      );
    }

    const body: unknown = await request.json();
    if (!validateBody(body)) {
      return NextResponse.json(
        { error: 'Invalid request. Required: device_token.' },
        { status: 400 }
      );
    }

    const { device_token, phone_model, openclaw_version } = body;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any;

    // Upsert: if this device_token already exists for this customer, update it.
    const { data: existing } = await supabase
      .from('devices')
      .select('id')
      .eq('device_token', device_token)
      .eq('customer_id', auth.user.id)
      .maybeSingle();

    if (existing) {
      const { data: device, error } = await supabase
        .from('devices')
        .update({
          phone_model: phone_model ?? null,
          openclaw_version: openclaw_version ?? null,
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error || !device) {
        return NextResponse.json(
          { error: 'Failed to update device.' },
          { status: 500 }
        );
      }

      return NextResponse.json({ device: device as Device });
    }

    // Insert new device
    const insert = {
      customer_id: auth.user.id,
      device_token,
      last_sync_at: null as string | null,
      phone_model: phone_model ?? null,
      openclaw_version: openclaw_version ?? null,
    };

    const { data: device, error } = await supabase
      .from('devices')
      .insert(insert)
      .select()
      .single();

    if (error || !device) {
      return NextResponse.json(
        { error: 'Failed to register device.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { device: device as Device },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth/device
// Headers: Authorization: Bearer <jwt>
// Response: { devices: Device[] }
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

    const supabase = createServiceRoleClient();
    const { data: devices, error } = await supabase
      .from('devices')
      .select('*')
      .eq('customer_id', auth.user.id)
      .order('registered_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch devices.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ devices: (devices ?? []) as Device[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

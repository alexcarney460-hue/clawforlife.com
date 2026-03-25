/**
 * GET /api/shipping  — List shipments (admin: all, customer: own orders' shipments)
 * POST /api/shipping — Create a shipment for an order (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminOrNull, getAuthOrNull } from '@/lib/auth/session';
import {
  createShipment,
  getShipmentsByStatus,
} from '@/lib/shipping/queries';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ShipmentStatus, Shipment } from '@/lib/types';

// ---------------------------------------------------------------------------
// GET — List shipments
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Check for admin first
  const admin = await getAdminOrNull();

  if (admin) {
    // Admin: list all shipments with optional filters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ShipmentStatus | null;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25', 10)));
    const offset = (page - 1) * limit;

    try {
      const result = await getShipmentsByStatus({
        status: status ?? undefined,
        limit,
        offset,
      });

      return NextResponse.json({
        shipments: result.shipments,
        total: result.total,
        page,
        limit,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch shipments';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Check for authenticated customer
  const auth = await getAuthOrNull();
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Customer: list shipments for their own orders only
  try {
    const supabase = createServiceRoleClient();

    // Get all order IDs belonging to this customer
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_id', auth.user.id);

    if (ordersError) {
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    const orderIds = (orders ?? []).map((o: { id: string }) => o.id);

    if (orderIds.length === 0) {
      return NextResponse.json({ shipments: [], total: 0 });
    }

    const { data: shipments, error: shipmentsError, count } = await supabase
      .from('shipments')
      .select('*', { count: 'exact' })
      .in('order_id', orderIds)
      .order('created_at', { ascending: false });

    if (shipmentsError) {
      return NextResponse.json({ error: 'Failed to fetch shipments' }, { status: 500 });
    }

    return NextResponse.json({
      shipments: (shipments ?? []) as Shipment[],
      total: count ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch shipments';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — Create shipment (admin only)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { order_id, carrier, tracking_number, status, metadata } = body;

  if (!order_id || typeof order_id !== 'string') {
    return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
  }

  try {
    const shipment = await createShipment({
      order_id,
      carrier: typeof carrier === 'string' ? carrier : null,
      tracking_number: typeof tracking_number === 'string' ? tracking_number : null,
      status: typeof status === 'string' ? (status as ShipmentStatus) : undefined,
      metadata: typeof metadata === 'object' && metadata !== null
        ? (metadata as Record<string, unknown>)
        : undefined,
    });

    return NextResponse.json({ shipment }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create shipment';
    const statusCode = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

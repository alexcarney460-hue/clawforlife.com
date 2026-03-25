/**
 * GET  /api/orders/[id]  — Single order detail (admin or owning customer)
 * PATCH /api/orders/[id] — Update order status (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrNull, getAdminOrNull } from '@/lib/auth/session';
import { getOrderById, updateOrderStatus } from '@/lib/orders/queries';
import type { OrderStatus } from '@/lib/types';

const VALID_STATUSES: OrderStatus[] = [
  'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded',
];

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// GET /api/orders/[id]
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthOrNull();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const order = await getOrderById(id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Customers can only view their own orders
    const isAdmin = auth.profile.role === 'admin';
    const isOwner = order.customer_id === auth.user.id || order.email === auth.profile.email;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ order });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[API /orders/[id]] GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/orders/[id]
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminOrNull();
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();

    // Validate status if provided
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Only allow updating specific fields
    const allowedFields = ['status', 'notes', 'metadata'] as const;
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update. Allowed: status, notes, metadata' },
        { status: 400 }
      );
    }

    const order = await updateOrderStatus(id, updates);
    return NextResponse.json({ order });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[API /orders/[id]] PATCH error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

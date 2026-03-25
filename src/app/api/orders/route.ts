/**
 * GET /api/orders
 *
 * Admin: returns all orders (with optional ?status= filter).
 * Customer: returns only their own orders.
 * Unauthenticated: 401.
 *
 * Query params:
 *   ?limit=25     — page size (max 100)
 *   ?offset=0     — pagination offset
 *   ?status=paid  — filter by order status (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrNull } from '@/lib/auth/session';
import { getOrdersAdmin, getOrdersByCustomer } from '@/lib/orders/queries';
import type { OrderStatus } from '@/lib/types';

const VALID_STATUSES: OrderStatus[] = [
  'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded',
];

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthOrNull();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '25', 10) || 25, 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0);

    const isAdmin = auth.profile.role === 'admin';

    if (isAdmin) {
      const statusParam = url.searchParams.get('status') as OrderStatus | null;
      const status = statusParam && VALID_STATUSES.includes(statusParam) ? statusParam : undefined;

      const result = await getOrdersAdmin({ limit, offset, status });
      return NextResponse.json({
        orders: result.orders,
        total: result.total,
        limit,
        offset,
      });
    }

    // Customer: fetch only their own orders
    const result = await getOrdersByCustomer(auth.user.id, { limit, offset });
    return NextResponse.json({
      orders: result.orders,
      total: result.total,
      limit,
      offset,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[API /orders] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

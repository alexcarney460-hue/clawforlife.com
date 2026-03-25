/**
 * GET /api/shipping/track/[orderId] — Public tracking by order ID
 *
 * Authenticated customers can check shipments for their own orders.
 * Returns a sanitized subset of shipment data (no internal metadata).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthOrNull } from '@/lib/auth/session';
import { getShipmentByOrder, getTrackingUrl } from '@/lib/shipping/queries';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Order } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const auth = await getAuthOrNull();
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { orderId } = await params;

  // Verify the order exists and belongs to this customer (or user is admin)
  const supabase = createServiceRoleClient();
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, customer_id')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const typedOrder = order as Pick<Order, 'id' | 'customer_id'>;
  const isOwner = typedOrder.customer_id === auth.user.id;
  const isAdmin = auth.profile.role === 'admin';

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const shipment = await getShipmentByOrder(orderId);

    if (!shipment) {
      return NextResponse.json({ shipment: null });
    }

    // Return sanitized tracking info -- no internal metadata
    return NextResponse.json({
      shipment: {
        id: shipment.id,
        order_id: shipment.order_id,
        carrier: shipment.carrier,
        tracking_number: shipment.tracking_number,
        tracking_url: shipment.tracking_url ?? getTrackingUrl(shipment.carrier, shipment.tracking_number),
        status: shipment.status,
        shipped_at: shipment.shipped_at,
        delivered_at: shipment.delivered_at,
        created_at: shipment.created_at,
        updated_at: shipment.updated_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch tracking info';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

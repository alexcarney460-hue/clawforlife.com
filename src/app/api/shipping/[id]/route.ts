/**
 * GET  /api/shipping/[id] — Shipment detail with tracking info (admin only)
 * PATCH /api/shipping/[id] — Update tracking/status (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminOrNull } from '@/lib/auth/session';
import {
  getShipmentById,
  updateShipment,
  getTrackingUrl,
} from '@/lib/shipping/queries';
import type { ShipmentStatus, ShipmentUpdate } from '@/lib/types';

// ---------------------------------------------------------------------------
// GET — Shipment detail + tracking
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const shipment = await getShipmentById(id);

    if (!shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    return NextResponse.json({
      shipment: {
        ...shipment,
        tracking_url: shipment.tracking_url ?? getTrackingUrl(shipment.carrier, shipment.tracking_number),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch shipment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — Update tracking / status
// ---------------------------------------------------------------------------

const VALID_STATUSES: ShipmentStatus[] = [
  'pending',
  'label_created',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'exception',
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate status if provided
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !VALID_STATUSES.includes(body.status as ShipmentStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }
  }

  // Build a safe update payload -- only pick known fields
  const updates: ShipmentUpdate = {};

  if (typeof body.carrier === 'string') updates.carrier = body.carrier;
  if (typeof body.tracking_number === 'string') updates.tracking_number = body.tracking_number;
  if (typeof body.status === 'string') updates.status = body.status as ShipmentStatus;
  if (typeof body.shipped_at === 'string') updates.shipped_at = body.shipped_at;
  if (typeof body.delivered_at === 'string') updates.delivered_at = body.delivered_at;
  if (typeof body.metadata === 'object' && body.metadata !== null) {
    updates.metadata = body.metadata as Record<string, unknown>;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  try {
    const shipment = await updateShipment(id, updates);

    return NextResponse.json({ shipment });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update shipment';
    const statusCode = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

/**
 * Shipping query functions for ClawForLife.
 *
 * All functions use the service-role client (bypasses RLS) because they are
 * called from trusted server contexts -- API routes only.
 * Authorization is enforced at the API-route layer, not here.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import type {
  Shipment,
  ShipmentInsert,
  ShipmentUpdate,
  ShipmentStatus,
  Order,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Carrier Helpers
// ---------------------------------------------------------------------------

export const CARRIERS = ['usps', 'ups', 'fedex', 'other'] as const;
export type Carrier = (typeof CARRIERS)[number];

/**
 * Generate a tracking URL for a given carrier and tracking number.
 * Returns null if the carrier is unknown or tracking number is missing.
 */
export function getTrackingUrl(
  carrier: string | null,
  trackingNumber: string | null
): string | null {
  if (!carrier || !trackingNumber) {
    return null;
  }

  const normalized = carrier.toLowerCase();

  switch (normalized) {
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
    case 'ups':
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Input Types
// ---------------------------------------------------------------------------

export interface CreateShipmentInput {
  order_id: string;
  carrier?: string | null;
  tracking_number?: string | null;
  status?: ShipmentStatus;
  shipped_at?: string | null;
  delivered_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ShipmentFilters {
  status?: ShipmentStatus;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Shipment CRUD
// ---------------------------------------------------------------------------

/**
 * Create a shipment for an order.
 * Validates that the order exists before creating.
 * If status is set to a shipped/delivered state, auto-sets the corresponding timestamp.
 */
export async function createShipment(
  input: CreateShipmentInput
): Promise<Shipment> {
  const supabase = createServiceRoleClient();

  // Verify the order exists
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id')
    .eq('id', input.order_id)
    .single();

  if (orderError || !order) {
    throw new Error(`Order not found: ${input.order_id}`);
  }

  const now = new Date().toISOString();
  const status = input.status ?? 'pending';

  const payload: ShipmentInsert = {
    order_id: input.order_id,
    carrier: input.carrier ?? null,
    tracking_number: input.tracking_number ?? null,
    tracking_url: getTrackingUrl(input.carrier ?? null, input.tracking_number ?? null),
    status,
    shipped_at: resolveShippedAt(status, input.shipped_at),
    delivered_at: resolveDeliveredAt(status, input.delivered_at),
    metadata: input.metadata ?? {},
  };

  const { data: shipment, error } = await supabase
    .from('shipments')
    .insert(payload)
    .select('*')
    .single();

  if (error || !shipment) {
    throw new Error(`Failed to create shipment: ${error?.message ?? 'unknown error'}`);
  }

  const typed = shipment as Shipment;

  // Sync order status if shipment starts in a fulfillment state
  await syncOrderStatus(typed.order_id, typed.status);

  return typed;
}

/**
 * Fetch a single shipment by its ID.
 */
export async function getShipmentById(
  shipmentId: string
): Promise<Shipment | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', shipmentId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Shipment;
}

/**
 * Fetch the shipment(s) associated with an order.
 * Returns the most recent shipment, or null if none exist.
 */
export async function getShipmentByOrder(
  orderId: string
): Promise<Shipment | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Shipment;
}

/**
 * Fetch all shipments for an order (supports multiple shipments per order).
 */
export async function getShipmentsByOrder(
  orderId: string
): Promise<Shipment[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch shipments for order ${orderId}: ${error.message}`);
  }

  return (data ?? []) as Shipment[];
}

/**
 * Update a shipment's tracking info and/or status.
 * Auto-sets shipped_at / delivered_at when status transitions occur.
 * Also syncs the parent order's status.
 */
export async function updateShipment(
  shipmentId: string,
  updates: ShipmentUpdate
): Promise<Shipment> {
  const supabase = createServiceRoleClient();

  // Fetch current shipment to detect status transitions
  const { data: current, error: fetchError } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', shipmentId)
    .single();

  if (fetchError || !current) {
    throw new Error(`Shipment not found: ${shipmentId}`);
  }

  const currentShipment = current as Shipment;
  const newStatus = updates.status ?? currentShipment.status;

  // Build the update payload with auto-timestamps
  const payload: ShipmentUpdate = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // Auto-set tracking_url when carrier or tracking number changes
  const carrier = updates.carrier ?? currentShipment.carrier;
  const trackingNumber = updates.tracking_number ?? currentShipment.tracking_number;
  if (updates.carrier !== undefined || updates.tracking_number !== undefined) {
    payload.tracking_url = getTrackingUrl(carrier, trackingNumber);
  }

  // Auto-set shipped_at on transition to a shipped state
  if (newStatus !== currentShipment.status) {
    if (isShippedStatus(newStatus) && !isShippedStatus(currentShipment.status)) {
      payload.shipped_at = updates.shipped_at ?? new Date().toISOString();
    }
    if (newStatus === 'delivered' && currentShipment.status !== 'delivered') {
      payload.delivered_at = updates.delivered_at ?? new Date().toISOString();
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('shipments')
    .update(payload)
    .eq('id', shipmentId)
    .select('*')
    .single();

  if (updateError || !updated) {
    throw new Error(
      `Failed to update shipment ${shipmentId}: ${updateError?.message ?? 'unknown error'}`
    );
  }

  const typed = updated as Shipment;

  // Sync order status when shipment status changes
  if (newStatus !== currentShipment.status) {
    await syncOrderStatus(typed.order_id, typed.status);
  }

  return typed;
}

/**
 * Fetch all shipments (admin). Supports pagination and optional status filter.
 */
export async function getShipmentsByStatus(
  filters: ShipmentFilters = {}
): Promise<{ shipments: Shipment[]; total: number }> {
  const supabase = createServiceRoleClient();
  const limit = filters.limit ?? 25;
  const offset = filters.offset ?? 0;

  let query = supabase
    .from('shipments')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch shipments: ${error.message}`);
  }

  return {
    shipments: (data ?? []) as Shipment[],
    total: count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/** Statuses that indicate the package has been handed to a carrier. */
function isShippedStatus(status: ShipmentStatus): boolean {
  return ['label_created', 'in_transit', 'out_for_delivery', 'delivered'].includes(status);
}

/** Resolve shipped_at: use explicit value, auto-set on shipped status, or null. */
function resolveShippedAt(
  status: ShipmentStatus,
  explicit?: string | null
): string | null {
  if (explicit) return explicit;
  if (isShippedStatus(status)) return new Date().toISOString();
  return null;
}

/** Resolve delivered_at: use explicit value, auto-set on delivered status, or null. */
function resolveDeliveredAt(
  status: ShipmentStatus,
  explicit?: string | null
): string | null {
  if (explicit) return explicit;
  if (status === 'delivered') return new Date().toISOString();
  return null;
}

/**
 * Sync the parent order's status based on the shipment status.
 * Maps shipment statuses to order statuses where appropriate.
 */
async function syncOrderStatus(
  orderId: string,
  shipmentStatus: ShipmentStatus
): Promise<void> {
  const supabase = createServiceRoleClient();

  // Map shipment status -> order status
  let orderStatus: string | null = null;
  if (shipmentStatus === 'in_transit' || shipmentStatus === 'out_for_delivery' || shipmentStatus === 'label_created') {
    orderStatus = 'shipped';
  } else if (shipmentStatus === 'delivered') {
    orderStatus = 'delivered';
  }

  if (!orderStatus) return;

  // Only update if the order isn't already in a terminal state
  const { data: order } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single();

  if (!order) return;

  const terminalStatuses = ['cancelled', 'refunded', 'delivered'];
  if (terminalStatuses.includes((order as Order).status)) return;

  await supabase
    .from('orders')
    .update({ status: orderStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId);
}

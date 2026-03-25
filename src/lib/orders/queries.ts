/**
 * Order query functions for ClawForLife.
 *
 * All functions use the service-role client (bypasses RLS) because they are
 * called from trusted server contexts — API routes and webhooks.
 * Authorization is enforced at the API-route layer, not here.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Order, OrderInsert, OrderUpdate, OrderItem, OrderItemInsert, OrderStatus } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable order number: CLF-YYYYMMDD-XXXX
 * where XXXX is a random 4-char hex string for uniqueness.
 */
function generateOrderNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `CLF-${y}${m}${d}-${rand}`;
}

// ---------------------------------------------------------------------------
// Order CRUD
// ---------------------------------------------------------------------------

export interface CreateOrderInput {
  order: OrderInsert;
  items: OrderItemInsert[];
}

/**
 * Create an order with its line items in a single transaction-like flow.
 * Returns the created order with items attached.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order & { items: OrderItem[] }> {
  const supabase = createServiceRoleClient();

  const orderPayload: OrderInsert = {
    ...input.order,
    order_number: input.order.order_number || generateOrderNumber(),
  };

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderPayload)
    .select('*')
    .single();

  if (orderError || !order) {
    throw new Error(`Failed to create order: ${orderError?.message ?? 'unknown error'}`);
  }

  const typedOrder = order as Order;

  // Insert line items, attaching the new order_id
  const itemPayloads: OrderItemInsert[] = input.items.map((item) => ({
    ...item,
    order_id: typedOrder.id,
  }));

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .insert(itemPayloads)
    .select('*');

  if (itemsError) {
    // Order was created but items failed — log and surface.
    // In production, a cleanup or retry mechanism would handle this.
    console.error(`[ORDERS] Items insert failed for order ${typedOrder.id}:`, itemsError.message);
    throw new Error(`Order created (${typedOrder.id}) but items failed: ${itemsError.message}`);
  }

  return { ...typedOrder, items: (items ?? []) as OrderItem[] };
}

/**
 * Fetch a single order by ID, optionally with its items.
 */
export async function getOrderById(
  orderId: string,
  includeItems = true
): Promise<(Order & { items?: OrderItem[] }) | null> {
  const supabase = createServiceRoleClient();

  const query = includeItems
    ? supabase.from('orders').select('*, order_items(*)').eq('id', orderId).single()
    : supabase.from('orders').select('*').eq('id', orderId).single();

  const { data, error } = await query;

  if (error || !data) {
    return null;
  }

  if (includeItems) {
    const raw = data as Record<string, unknown>;
    const items = (raw.order_items ?? []) as OrderItem[];
    const { order_items: _discarded, ...orderFields } = raw;
    return { ...(orderFields as unknown as Order), items };
  }

  return data as Order;
}

/**
 * Fetch orders for a specific customer, newest first.
 * Supports simple offset-based pagination.
 */
export async function getOrdersByCustomer(
  customerIdOrEmail: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<{ orders: Order[]; total: number }> {
  const supabase = createServiceRoleClient();
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;

  // Determine whether this is a UUID (customer_id) or email
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerIdOrEmail);
  const column = isUuid ? 'customer_id' : 'email';

  const { data, error, count } = await supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq(column, customerIdOrEmail)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return {
    orders: (data ?? []) as Order[],
    total: count ?? 0,
  };
}

/**
 * Fetch all orders (admin). Supports pagination and optional status filter.
 */
export async function getOrdersAdmin(
  opts: { limit?: number; offset?: number; status?: OrderStatus } = {}
): Promise<{ orders: Order[]; total: number }> {
  const supabase = createServiceRoleClient();
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status) {
    query = query.eq('status', opts.status);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return {
    orders: (data ?? []) as Order[],
    total: count ?? 0,
  };
}

/**
 * Update an order's status (and optionally other fields).
 * Returns the updated order.
 */
export async function updateOrderStatus(
  orderId: string,
  updates: OrderUpdate
): Promise<Order> {
  const supabase = createServiceRoleClient();

  const payload: OrderUpdate = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', orderId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update order ${orderId}: ${error?.message ?? 'not found'}`);
  }

  return data as Order;
}

/**
 * Check if an order with this Stripe session ID already exists.
 * Used for idempotency in webhook processing.
 */
export async function getOrderByStripeSession(sessionId: string): Promise<Order | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('stripe_session_id', sessionId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Order;
}

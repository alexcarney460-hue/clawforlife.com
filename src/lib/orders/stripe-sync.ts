/**
 * Stripe-to-Supabase order synchronization.
 *
 * Called from the webhook handler after checkout.session.completed.
 * Extracts order data from the Stripe session and persists it.
 */

import Stripe from 'stripe';
import { createOrder, getOrderByStripeSession } from '@/lib/orders/queries';
import type { OrderInsert, OrderItemInsert } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  success: boolean;
  orderId: string | null;
  orderNumber: string | null;
  error: string | null;
  skipped: boolean;
}

// ---------------------------------------------------------------------------
// Stripe session → Supabase order
// ---------------------------------------------------------------------------

/**
 * Synchronize a completed Stripe checkout session into the orders table.
 *
 * This function is idempotent — if an order with the same stripe_session_id
 * already exists, it returns early without creating a duplicate.
 */
export async function syncStripeCheckout(session: Stripe.Checkout.Session): Promise<SyncResult> {
  try {
    // Idempotency check: skip if already persisted
    const existing = await getOrderByStripeSession(session.id);
    if (existing) {
      console.log(`[STRIPE-SYNC] Order already exists for session ${session.id}, skipping`);
      return {
        success: true,
        orderId: existing.id,
        orderNumber: existing.order_number,
        error: null,
        skipped: true,
      };
    }

    const meta = session.metadata ?? {};
    const customerDetails = session.customer_details;
    const shipping = session.shipping_details;
    const amountTotal = session.amount_total ?? 0;

    // Build order insert
    const orderInsert: OrderInsert = {
      order_number: generateOrderNumber(),
      customer_id: null, // Guest checkout — no auth user yet
      email: customerDetails?.email ?? meta.customer_email ?? 'unknown@clawforlife.com',
      status: 'paid',
      subtotal_cents: amountTotal, // Stripe doesn't break out subtotal in basic checkout
      tax_cents: 0,
      shipping_cents: 0,
      total_cents: amountTotal,
      currency: session.currency ?? 'usd',
      stripe_session_id: session.id,
      stripe_payment_intent_id: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
      shipping_name: shipping?.name ?? customerDetails?.name ?? null,
      shipping_email: customerDetails?.email ?? null,
      shipping_phone: customerDetails?.phone ?? meta.customer_phone ?? null,
      shipping_line1: shipping?.address?.line1 ?? null,
      shipping_line2: shipping?.address?.line2 ?? null,
      shipping_city: shipping?.address?.city ?? null,
      shipping_state: shipping?.address?.state ?? null,
      shipping_zip: shipping?.address?.postal_code ?? null,
      shipping_country: shipping?.address?.country ?? 'US',
      notes: null,
      metadata: {
        stripe_tier: meta.tier ?? 'unknown',
        stripe_items_summary: meta.items ?? '',
        stripe_skills: meta.skills ?? '',
      },
    };

    // Build line items from metadata
    const items = buildLineItems(meta);

    const order = await createOrder({ order: orderInsert, items });

    console.log(`[STRIPE-SYNC] Created order ${order.order_number} (${order.id}) with ${order.items.length} items`);

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      error: null,
      skipped: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    console.error(`[STRIPE-SYNC] Failed to sync session ${session.id}:`, message);
    return {
      success: false,
      orderId: null,
      orderNumber: null,
      error: message,
      skipped: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function generateOrderNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `CLF-${y}${m}${d}-${rand}`;
}

/**
 * Parse Stripe metadata to reconstruct line items.
 *
 * The checkout route stores:
 *   metadata.tier = "cart"
 *   metadata.items = "Phone x1, Lead Gen Skill x1"
 *   metadata.skills = "Lead Gen | Content Creator"
 *
 * We parse the items string back into OrderItemInsert[].
 * If parsing fails, we create a single fallback item.
 */
function buildLineItems(meta: Record<string, string>): OrderItemInsert[] {
  const itemsSummary = meta.items ?? '';
  const tier = meta.tier ?? 'unknown';

  if (!itemsSummary) {
    // Fallback: single unknown item
    return [
      {
        order_id: '', // Will be set by createOrder
        product_id: null,
        name: `${tier} purchase`,
        product_type: tier === 'skills' ? 'skill' : tier === 'package' ? 'package' : 'phone',
        quantity: 1,
        unit_price_cents: 0,
        total_cents: 0,
      },
    ];
  }

  // Parse "Phone x1, Lead Gen Skill x2" format
  const parts = itemsSummary.split(',').map((s) => s.trim()).filter(Boolean);
  const items: OrderItemInsert[] = [];

  for (const part of parts) {
    const match = part.match(/^(.+?)\s+x(\d+)$/);
    if (match) {
      const name = match[1].trim();
      const quantity = parseInt(match[2], 10);
      const productType = inferProductType(name);

      items.push({
        order_id: '', // Will be set by createOrder
        product_id: null,
        name,
        product_type: productType,
        quantity,
        unit_price_cents: 0, // Price not available in metadata; will be enriched later
        total_cents: 0,
      });
    } else {
      // Could not parse — use raw string
      items.push({
        order_id: '', // Will be set by createOrder
        product_id: null,
        name: part,
        product_type: 'skill',
        quantity: 1,
        unit_price_cents: 0,
        total_cents: 0,
      });
    }
  }

  return items.length > 0 ? items : [{
    order_id: '',
    product_id: null,
    name: `${tier} purchase`,
    product_type: 'skill',
    quantity: 1,
    unit_price_cents: 0,
    total_cents: 0,
  }];
}

/**
 * Infer product type from item name.
 */
function inferProductType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('phone') || lower.includes('galaxy') || lower.includes('samsung')) {
    return 'phone';
  }
  if (lower.includes('package') || lower.includes('agent') || lower.includes('bundle')) {
    return 'package';
  }
  return 'skill';
}

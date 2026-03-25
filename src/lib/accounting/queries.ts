/**
 * Accounting query functions for ClawForLife.
 *
 * All functions use the service-role client (bypasses RLS) because they are
 * called from trusted server contexts (API routes). Authorization is enforced
 * at the API-route layer via getAdminOrNull(), not here.
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import type {
  Invoice,
  InvoiceInsert,
  InvoiceStatus,
  Order,
  OrderItem,
  TaxRate,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Invoice Number Generation
// ---------------------------------------------------------------------------

/**
 * Generate a unique invoice number: INV-YYYYMMDD-NNN
 * where NNN is a zero-padded sequential number for that date.
 *
 * Queries existing invoices for the current date to determine the next
 * sequence number, ensuring uniqueness.
 */
async function generateInvoiceNumber(): Promise<string> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const datePrefix = `INV-${y}${m}${d}-`;

  // Count existing invoices for today to determine next sequence number
  const { count, error } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .like('invoice_number', `${datePrefix}%`);

  if (error) {
    // Fallback to random suffix if count query fails
    const rand = Math.random().toString(16).slice(2, 5).toUpperCase();
    return `${datePrefix}${rand}`;
  }

  const sequence = String((count ?? 0) + 1).padStart(3, '0');
  return `${datePrefix}${sequence}`;
}

// ---------------------------------------------------------------------------
// Invoice CRUD
// ---------------------------------------------------------------------------

export interface CreateInvoiceInput {
  order_id: string;
}

/**
 * Create an invoice from an existing order.
 *
 * Fetches the order to pull subtotal, tax, total, and customer info.
 * Generates a unique invoice number and sets status based on order status.
 */
export async function createInvoice(
  input: CreateInvoiceInput
): Promise<Invoice> {
  const supabase = createServiceRoleClient();

  // Fetch the order to derive invoice amounts
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', input.order_id)
    .single();

  if (orderError || !order) {
    throw new Error(
      `Order not found: ${orderError?.message ?? 'unknown error'}`
    );
  }

  const typedOrder = order as Order;

  // Check for duplicate invoice on this order
  const { data: existing } = await supabase
    .from('invoices')
    .select('id, invoice_number')
    .eq('order_id', input.order_id)
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error(
      `Invoice already exists for order ${input.order_id}: ${existing[0].invoice_number}`
    );
  }

  // Determine tax rate from shipping state if available
  let taxRate = 0;
  let taxJurisdiction: string | null = null;

  if (typedOrder.shipping_state) {
    const { data: rate } = await supabase
      .from('tax_rates')
      .select('*')
      .eq('state_code', typedOrder.shipping_state.toUpperCase())
      .eq('active', true)
      .single();

    if (rate) {
      const typedRate = rate as TaxRate;
      taxRate = typedRate.rate;
      taxJurisdiction = typedRate.state_code;
    }
  }

  const invoiceNumber = await generateInvoiceNumber();

  // Determine invoice status based on order payment status
  const isPaid = typedOrder.status === 'paid' || typedOrder.status === 'processing'
    || typedOrder.status === 'shipped' || typedOrder.status === 'delivered';

  const now = new Date().toISOString();

  const payload: InvoiceInsert = {
    invoice_number: invoiceNumber,
    order_id: input.order_id,
    customer_id: typedOrder.customer_id,
    subtotal_cents: typedOrder.subtotal_cents,
    tax_cents: typedOrder.tax_cents,
    total_cents: typedOrder.total_cents,
    tax_rate: taxRate,
    tax_jurisdiction: taxJurisdiction,
    status: isPaid ? 'paid' : 'issued',
    issued_at: now,
    paid_at: isPaid ? now : null,
    pdf_storage_path: null,
  };

  const { data: invoice, error: insertError } = await supabase
    .from('invoices')
    .insert(payload)
    .select('*')
    .single();

  if (insertError || !invoice) {
    throw new Error(
      `Failed to create invoice: ${insertError?.message ?? 'unknown error'}`
    );
  }

  return invoice as Invoice;
}

/**
 * Fetch invoices with pagination and optional status filter.
 * Ordered by creation date descending (newest first).
 */
export async function getInvoices(
  opts: {
    limit?: number;
    offset?: number;
    status?: InvoiceStatus;
    start?: string;
    end?: string;
  } = {}
): Promise<{ invoices: Invoice[]; total: number }> {
  const supabase = createServiceRoleClient();
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;

  let query = supabase
    .from('invoices')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status) {
    query = query.eq('status', opts.status);
  }

  if (opts.start) {
    query = query.gte('created_at', opts.start);
  }

  if (opts.end) {
    query = query.lte('created_at', opts.end);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch invoices: ${error.message}`);
  }

  return {
    invoices: (data ?? []) as Invoice[],
    total: count ?? 0,
  };
}

/**
 * Fetch a single invoice by ID, with its related order and order items.
 */
export async function getInvoiceById(
  invoiceId: string
): Promise<(Invoice & { order?: Order & { items?: OrderItem[] } }) | null> {
  const supabase = createServiceRoleClient();

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (error || !invoice) {
    return null;
  }

  const typedInvoice = invoice as Invoice;

  // Fetch associated order with line items for the detail view
  const { data: orderData } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', typedInvoice.order_id)
    .single();

  if (orderData) {
    const raw = orderData as Record<string, unknown>;
    const items = (raw.order_items ?? []) as OrderItem[];
    const { order_items: _discarded, ...orderFields } = raw;
    return {
      ...typedInvoice,
      order: { ...(orderFields as unknown as Order), items },
    };
  }

  return typedInvoice;
}

// ---------------------------------------------------------------------------
// Revenue Summary
// ---------------------------------------------------------------------------

export interface RevenuePeriod {
  period: string;
  gross_cents: number;
  tax_cents: number;
  refund_cents: number;
  net_cents: number;
  order_count: number;
}

export interface RevenueSummary {
  periods: RevenuePeriod[];
  totals: {
    gross_cents: number;
    tax_cents: number;
    refund_cents: number;
    net_cents: number;
    order_count: number;
  };
}

/**
 * Get revenue summary broken down by period (month or day).
 *
 * Gross = sum of all paid order totals.
 * Refunds = sum of all refunded order totals.
 * Tax = sum of all paid order tax.
 * Net = gross - refunds.
 *
 * Uses the orders table as the source of truth.
 */
export async function getRevenueSummary(opts: {
  start?: string;
  end?: string;
  group_by?: 'month' | 'day';
}): Promise<RevenueSummary> {
  const supabase = createServiceRoleClient();
  const groupBy = opts.group_by ?? 'month';

  // Fetch paid orders (all non-pending, non-cancelled statuses)
  let paidQuery = supabase
    .from('orders')
    .select('total_cents, tax_cents, subtotal_cents, status, created_at')
    .in('status', ['paid', 'processing', 'shipped', 'delivered']);

  if (opts.start) {
    paidQuery = paidQuery.gte('created_at', opts.start);
  }
  if (opts.end) {
    paidQuery = paidQuery.lte('created_at', opts.end);
  }

  const { data: paidOrders, error: paidError } = await paidQuery;

  if (paidError) {
    throw new Error(`Failed to fetch paid orders: ${paidError.message}`);
  }

  // Fetch refunded orders separately
  let refundQuery = supabase
    .from('orders')
    .select('total_cents, tax_cents, status, created_at')
    .eq('status', 'refunded');

  if (opts.start) {
    refundQuery = refundQuery.gte('created_at', opts.start);
  }
  if (opts.end) {
    refundQuery = refundQuery.lte('created_at', opts.end);
  }

  const { data: refundedOrders, error: refundError } = await refundQuery;

  if (refundError) {
    throw new Error(`Failed to fetch refunded orders: ${refundError.message}`);
  }

  // Group results by period
  const periodMap = new Map<string, RevenuePeriod>();

  function getPeriodKey(dateStr: string): string {
    const date = new Date(dateStr);
    if (groupBy === 'day') {
      return date.toISOString().slice(0, 10); // YYYY-MM-DD
    }
    return date.toISOString().slice(0, 7); // YYYY-MM
  }

  function ensurePeriod(key: string): RevenuePeriod {
    const existing = periodMap.get(key);
    if (existing) {
      return existing;
    }
    const period: RevenuePeriod = {
      period: key,
      gross_cents: 0,
      tax_cents: 0,
      refund_cents: 0,
      net_cents: 0,
      order_count: 0,
    };
    periodMap.set(key, period);
    return period;
  }

  // Accumulate paid orders
  for (const order of paidOrders ?? []) {
    const key = getPeriodKey(order.created_at);
    const period = ensurePeriod(key);
    period.gross_cents += order.total_cents;
    period.tax_cents += order.tax_cents;
    period.order_count += 1;
  }

  // Accumulate refunds
  for (const order of refundedOrders ?? []) {
    const key = getPeriodKey(order.created_at);
    const period = ensurePeriod(key);
    period.refund_cents += order.total_cents;
  }

  // Calculate net for each period
  const periods = Array.from(periodMap.values())
    .map((p) => ({
      ...p,
      net_cents: p.gross_cents - p.refund_cents,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  // Calculate totals
  const totals = periods.reduce(
    (acc, p) => ({
      gross_cents: acc.gross_cents + p.gross_cents,
      tax_cents: acc.tax_cents + p.tax_cents,
      refund_cents: acc.refund_cents + p.refund_cents,
      net_cents: acc.net_cents + p.net_cents,
      order_count: acc.order_count + p.order_count,
    }),
    {
      gross_cents: 0,
      tax_cents: 0,
      refund_cents: 0,
      net_cents: 0,
      order_count: 0,
    }
  );

  return { periods, totals };
}

// ---------------------------------------------------------------------------
// Tax Summary
// ---------------------------------------------------------------------------

export interface TaxSummaryEntry {
  state_code: string;
  state_name: string;
  rate: number;
  taxable_amount_cents: number;
  tax_collected_cents: number;
  order_count: number;
}

export interface TaxSummary {
  entries: TaxSummaryEntry[];
  total_tax_collected_cents: number;
  total_taxable_amount_cents: number;
}

/**
 * Get tax summary grouped by state/jurisdiction.
 *
 * Joins invoices with tax_rates to produce a breakdown of tax collected
 * per jurisdiction within the given date range.
 */
export async function getTaxSummary(opts: {
  start?: string;
  end?: string;
}): Promise<TaxSummary> {
  const supabase = createServiceRoleClient();

  // Fetch paid invoices with tax jurisdiction info
  let query = supabase
    .from('invoices')
    .select('subtotal_cents, tax_cents, tax_rate, tax_jurisdiction, status')
    .in('status', ['paid', 'issued']);

  if (opts.start) {
    query = query.gte('created_at', opts.start);
  }
  if (opts.end) {
    query = query.lte('created_at', opts.end);
  }

  const { data: invoices, error: invoiceError } = await query;

  if (invoiceError) {
    throw new Error(`Failed to fetch invoices: ${invoiceError.message}`);
  }

  // Fetch all active tax rates for state name lookups
  const { data: taxRates } = await supabase
    .from('tax_rates')
    .select('*')
    .eq('active', true);

  const rateMap = new Map<string, TaxRate>();
  for (const rate of (taxRates ?? []) as TaxRate[]) {
    rateMap.set(rate.state_code, rate);
  }

  // Group by jurisdiction
  const jurisdictionMap = new Map<string, TaxSummaryEntry>();

  for (const inv of invoices ?? []) {
    const stateCode = inv.tax_jurisdiction ?? 'UNKNOWN';
    const existing = jurisdictionMap.get(stateCode);

    if (existing) {
      existing.taxable_amount_cents += inv.subtotal_cents;
      existing.tax_collected_cents += inv.tax_cents;
      existing.order_count += 1;
    } else {
      const rateInfo = rateMap.get(stateCode);
      jurisdictionMap.set(stateCode, {
        state_code: stateCode,
        state_name: rateInfo?.state_name ?? stateCode,
        rate: inv.tax_rate ?? rateInfo?.rate ?? 0,
        taxable_amount_cents: inv.subtotal_cents,
        tax_collected_cents: inv.tax_cents,
        order_count: 1,
      });
    }
  }

  const entries = Array.from(jurisdictionMap.values()).sort(
    (a, b) => b.tax_collected_cents - a.tax_collected_cents
  );

  const totalTax = entries.reduce((sum, e) => sum + e.tax_collected_cents, 0);
  const totalTaxable = entries.reduce(
    (sum, e) => sum + e.taxable_amount_cents,
    0
  );

  return {
    entries,
    total_tax_collected_cents: totalTax,
    total_taxable_amount_cents: totalTaxable,
  };
}

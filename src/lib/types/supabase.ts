/**
 * Supabase Database types for ClawForLife.
 *
 * This file is meant to be replaced by `npx supabase gen types typescript`
 * once the Supabase project is provisioned. The manual definitions below
 * match the 001_initial_schema.sql migration exactly and let other agents
 * build against concrete types right now.
 */

// ---------------------------------------------------------------------------
// Enum-like union types
// ---------------------------------------------------------------------------

export type UserRole = 'customer' | 'admin';

export type ProductType = 'phone' | 'package' | 'skill';

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type ShipmentStatus =
  | 'pending'
  | 'label_created'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

export type ContactChannel = 'email' | 'phone' | 'sms' | 'telegram' | 'manual';

export type ContactDirection = 'inbound' | 'outbound';

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void';

// ---------------------------------------------------------------------------
// Row / Insert / Update helpers
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
};

export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at'>>;

// ---------------------------------------------------------------------------

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  product_type: ProductType;
  category: string | null;
  stripe_price_id: string | null;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ProductInsert = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'active' | 'metadata'> & {
  id?: string;
  active?: boolean;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type ProductUpdate = Partial<Omit<Product, 'id' | 'created_at'>>;

// ---------------------------------------------------------------------------

export interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  email: string;
  status: OrderStatus;
  subtotal_cents: number;
  tax_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  shipping_name: string | null;
  shipping_email: string | null;
  shipping_phone: string | null;
  shipping_line1: string | null;
  shipping_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type OrderInsert = Omit<
  Order,
  'id' | 'created_at' | 'updated_at' | 'status' | 'tax_cents' | 'shipping_cents' | 'currency' | 'shipping_country' | 'metadata'
> & {
  id?: string;
  status?: OrderStatus;
  tax_cents?: number;
  shipping_cents?: number;
  currency?: string;
  shipping_country?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type OrderUpdate = Partial<Omit<Order, 'id' | 'created_at'>>;

// ---------------------------------------------------------------------------

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  product_type: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type OrderItemInsert = Omit<OrderItem, 'id' | 'created_at' | 'quantity' | 'metadata'> & {
  id?: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

// ---------------------------------------------------------------------------

export interface Device {
  id: string;
  customer_id: string | null;
  device_token: string;
  phone_model: string | null;
  openclaw_version: string | null;
  last_sync_at: string | null;
  registered_at: string;
  metadata: Record<string, unknown>;
}

export type DeviceInsert = Omit<Device, 'id' | 'registered_at' | 'phone_model' | 'metadata'> & {
  id?: string;
  phone_model?: string;
  metadata?: Record<string, unknown>;
  registered_at?: string;
};

export type DeviceUpdate = Partial<Omit<Device, 'id' | 'registered_at'>>;

// ---------------------------------------------------------------------------

export interface SkillEntitlement {
  id: string;
  customer_id: string;
  product_id: string | null;
  skill_slug: string;
  order_id: string | null;
  stripe_subscription_id: string | null;
  active: boolean;
  activated_at: string;
  expires_at: string | null;
  created_at: string;
}

export type SkillEntitlementInsert = Omit<
  SkillEntitlement,
  'id' | 'created_at' | 'active' | 'activated_at'
> & {
  id?: string;
  active?: boolean;
  activated_at?: string;
  created_at?: string;
};

// ---------------------------------------------------------------------------

export interface Shipment {
  id: string;
  order_id: string;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  status: ShipmentStatus;
  shipped_at: string | null;
  delivered_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ShipmentInsert = Omit<Shipment, 'id' | 'created_at' | 'updated_at' | 'status' | 'metadata'> & {
  id?: string;
  status?: ShipmentStatus;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type ShipmentUpdate = Partial<Omit<Shipment, 'id' | 'created_at'>>;

// ---------------------------------------------------------------------------

export interface Lead {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  company: string | null;
  source: string | null;
  status: LeadStatus;
  converted_to_customer_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type LeadInsert = Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'status' | 'metadata'> & {
  id?: string;
  status?: LeadStatus;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type LeadUpdate = Partial<Omit<Lead, 'id' | 'created_at'>>;

// ---------------------------------------------------------------------------

export interface ContactHistory {
  id: string;
  lead_id: string | null;
  customer_id: string | null;
  channel: ContactChannel;
  direction: ContactDirection;
  subject: string | null;
  body: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type ContactHistoryInsert = Omit<ContactHistory, 'id' | 'created_at' | 'metadata'> & {
  id?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

// ---------------------------------------------------------------------------

export interface AnalyticsEvent {
  id: string;
  event_type: string;
  session_id: string | null;
  customer_id: string | null;
  page_url: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  properties: Record<string, unknown>;
  created_at: string;
}

export type AnalyticsEventInsert = Omit<AnalyticsEvent, 'id' | 'created_at' | 'properties'> & {
  id?: string;
  properties?: Record<string, unknown>;
  created_at?: string;
};

// ---------------------------------------------------------------------------

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  customer_id: string | null;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  tax_rate: number;
  tax_jurisdiction: string | null;
  status: InvoiceStatus;
  issued_at: string | null;
  paid_at: string | null;
  pdf_storage_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type InvoiceInsert = Omit<
  Invoice,
  'id' | 'created_at' | 'updated_at' | 'status' | 'tax_cents' | 'tax_rate' | 'metadata'
> & {
  id?: string;
  status?: InvoiceStatus;
  tax_cents?: number;
  tax_rate?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type InvoiceUpdate = Partial<Omit<Invoice, 'id' | 'created_at'>>;

// ---------------------------------------------------------------------------

export interface TaxRate {
  id: string;
  state_code: string;
  state_name: string;
  rate: number;
  active: boolean;
  updated_at: string;
}

export type TaxRateInsert = Omit<TaxRate, 'id' | 'updated_at' | 'active'> & {
  id?: string;
  active?: boolean;
  updated_at?: string;
};

export type TaxRateUpdate = Partial<Omit<TaxRate, 'id'>>;

// ---------------------------------------------------------------------------
// Database interface (mirrors Supabase generated structure)
// ---------------------------------------------------------------------------

type TableDef<R, I, U> = {
  Row: R;
  Insert: I;
  Update: U;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<Profile, ProfileInsert, ProfileUpdate>;
      products: TableDef<Product, ProductInsert, ProductUpdate>;
      orders: TableDef<Order, OrderInsert, OrderUpdate>;
      order_items: TableDef<OrderItem, OrderItemInsert, Record<string, never>>;
      devices: TableDef<Device, DeviceInsert, DeviceUpdate>;
      skill_entitlements: TableDef<SkillEntitlement, SkillEntitlementInsert, Partial<Omit<SkillEntitlement, 'id' | 'created_at'>>>;
      shipments: TableDef<Shipment, ShipmentInsert, ShipmentUpdate>;
      leads: TableDef<Lead, LeadInsert, LeadUpdate>;
      contact_history: TableDef<ContactHistory, ContactHistoryInsert, Record<string, never>>;
      analytics_events: TableDef<AnalyticsEvent, AnalyticsEventInsert, Record<string, never>>;
      invoices: TableDef<Invoice, InvoiceInsert, InvoiceUpdate>;
      tax_rates: TableDef<TaxRate, TaxRateInsert, TaxRateUpdate>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

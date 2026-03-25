# ClawForLife Backend Architecture Blueprint

## Status: PROPOSED
## Date: 2026-03-24

---

## CURRENT STATE

```
src/
  app/
    api/
      checkout/route.ts    <-- Stripe checkout (EXISTING, DO NOT MODIFY)
      webhook/route.ts     <-- Stripe webhook (EXISTING, DO NOT MODIFY)
    cart/page.tsx
    marketplace/page.tsx
    success/page.tsx
    page.tsx
    layout.tsx
    globals.css
  components/
    CartProvider.tsx
    CartIcon.tsx
    FAQ.tsx
    FeatureGrid.tsx
    Footer.tsx
    Navbar.tsx
    PhoneScene.tsx
    PhoneShowcase.tsx
    PricingCard.tsx
    TerminalDemo.tsx
```

Stack: Next.js 15.2.6, React 19, TypeScript, Tailwind v4, Stripe (live), Vercel hosting.
Database: None yet. Orders logged to Telegram only. Cart is localStorage.

---

## ARCHITECTURAL DECISIONS

### ADR-001: Modular Monolith over Microservices

**Context**: 8 feature modules needed, single developer, Vercel hosting (serverless).
**Decision**: All modules live in one Next.js app, separated by directory convention. Each module owns its API routes and lib files. No separate services.
**Consequences**: Simple deployment, shared Supabase client, no network hops between modules. Trade-off: modules must be disciplined about not importing each other's internals.

### ADR-002: Supabase as Single Database + Auth Provider

**Context**: Need database, auth, and RLS. Already using Supabase for other projects.
**Decision**: One Supabase project for everything -- Postgres tables, RLS policies, Auth (email/password), and Storage (invoices).
**Consequences**: Single source of truth, built-in auth with JWT, row-level security. Trade-off: vendor lock-in to Supabase (acceptable given existing familiarity).

### ADR-003: Webhook as System Entrypoint

**Context**: The existing Stripe webhook is the only server-side entrypoint that fires on purchase. Currently it only sends Telegram messages.
**Decision**: The webhook handler (Agent 3) extends the existing webhook to also persist orders to Supabase. It does NOT replace the Telegram notification. The webhook becomes the "order created" event source.
**Consequences**: Orders are persisted at payment confirmation, not at checkout creation. Reliable because Stripe retries failed webhooks. Trade-off: slight delay between payment and DB write (seconds).

### ADR-004: Shared Types via /src/lib/types/

**Context**: 8 agents will work in parallel and need to reference the same TypeScript types.
**Decision**: All shared types (DB row types, API request/response shapes, enums) live in `src/lib/types/`. Generated Supabase types go in `src/lib/types/supabase.ts`.
**Consequences**: Single source of truth for types, no type drift between modules.

---

## SUPABASE SCHEMA (Agent 1 Owns)

Agent 1 creates ALL tables, RLS policies, indexes, and the generated types file. No other agent creates tables.

### Tables

```sql
-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- ============================================================
-- PRODUCTS (phones, packages, skills)
-- ============================================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('phone', 'package', 'skill')),
  category TEXT,           -- for skills: lead-gen, content, marketing, etc.
  stripe_price_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_slug ON public.products(slug);
CREATE INDEX idx_products_type ON public.products(product_type);
CREATE INDEX idx_products_active ON public.products(active);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,        -- CLF-20260324-XXXX
  customer_id UUID REFERENCES public.profiles(id),
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  )),
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  shipping_name TEXT,
  shipping_email TEXT,
  shipping_phone TEXT,
  shipping_line1 TEXT,
  shipping_line2 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_country TEXT DEFAULT 'US',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_email ON public.orders(email);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_number ON public.orders(order_number);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX idx_orders_stripe_session ON public.orders(stripe_session_id);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  name TEXT NOT NULL,
  product_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_order_items_product ON public.order_items(product_id);

-- ============================================================
-- DEVICES (registered phones)
-- ============================================================
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(id),
  device_token TEXT UNIQUE NOT NULL,
  phone_model TEXT DEFAULT 'Samsung Galaxy A16 5G',
  openclaw_version TEXT,
  last_sync_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_devices_customer ON public.devices(customer_id);
CREATE INDEX idx_devices_token ON public.devices(device_token);

-- ============================================================
-- SKILL ENTITLEMENTS
-- ============================================================
CREATE TABLE public.skill_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  product_id UUID REFERENCES public.products(id),
  skill_slug TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id),
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, skill_slug)
);

CREATE INDEX idx_entitlements_customer ON public.skill_entitlements(customer_id);
CREATE INDEX idx_entitlements_active ON public.skill_entitlements(active);

-- ============================================================
-- SHIPPING TRACKING
-- ============================================================
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  carrier TEXT,                              -- usps, ups, fedex
  tracking_number TEXT,
  tracking_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'label_created', 'in_transit', 'out_for_delivery', 'delivered', 'exception'
  )),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shipments_order ON public.shipments(order_id);
CREATE INDEX idx_shipments_tracking ON public.shipments(tracking_number);
CREATE INDEX idx_shipments_status ON public.shipments(status);

-- ============================================================
-- CRM: LEADS
-- ============================================================
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  full_name TEXT,
  company TEXT,
  source TEXT,                               -- website, referral, ad, manual
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'contacted', 'qualified', 'converted', 'lost'
  )),
  converted_to_customer_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_email ON public.leads(email);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_created ON public.leads(created_at DESC);

-- ============================================================
-- CRM: CONTACT HISTORY
-- ============================================================
CREATE TABLE public.contact_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'phone', 'sms', 'telegram', 'manual')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  body TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contact_has_target CHECK (lead_id IS NOT NULL OR customer_id IS NOT NULL)
);

CREATE INDEX idx_contact_lead ON public.contact_history(lead_id);
CREATE INDEX idx_contact_customer ON public.contact_history(customer_id);
CREATE INDEX idx_contact_created ON public.contact_history(created_at DESC);

-- ============================================================
-- ANALYTICS: EVENTS
-- ============================================================
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,                  -- page_view, add_to_cart, checkout_start, purchase, etc.
  session_id TEXT,
  customer_id UUID REFERENCES public.profiles(id),
  page_url TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_session ON public.analytics_events(session_id);
CREATE INDEX idx_analytics_created ON public.analytics_events(created_at DESC);
CREATE INDEX idx_analytics_customer ON public.analytics_events(customer_id);

-- ============================================================
-- ACCOUNTING: INVOICES
-- ============================================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,       -- INV-20260324-XXXX
  order_id UUID NOT NULL REFERENCES public.orders(id),
  customer_id UUID REFERENCES public.profiles(id),
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  tax_rate NUMERIC(5,4) DEFAULT 0,
  tax_jurisdiction TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  pdf_storage_path TEXT,                     -- Supabase storage path
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_order ON public.invoices(order_id);
CREATE INDEX idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_number ON public.invoices(invoice_number);

-- ============================================================
-- ACCOUNTING: TAX RATES (US state sales tax)
-- ============================================================
CREATE TABLE public.tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code TEXT UNIQUE NOT NULL,
  state_name TEXT NOT NULL,
  rate NUMERIC(5,4) NOT NULL,                -- e.g. 0.0725 for 7.25%
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tax_rates_state ON public.tax_rates(state_code);
```

### RLS Policies

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

-- PROFILES: users see their own, admins see all
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin full access profiles" ON public.profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- PRODUCTS: public read, admin write
CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (active = true);
CREATE POLICY "Admin full access products" ON public.products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ORDERS: customers see their own, admins see all
CREATE POLICY "Customers view own orders" ON public.orders
  FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Admin full access orders" ON public.orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ORDER ITEMS: same as orders (via join)
CREATE POLICY "Customers view own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.customer_id = auth.uid())
  );
CREATE POLICY "Admin full access order items" ON public.order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- DEVICES: customers see their own
CREATE POLICY "Customers view own devices" ON public.devices
  FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Customers manage own devices" ON public.devices
  FOR ALL USING (customer_id = auth.uid());
CREATE POLICY "Admin full access devices" ON public.devices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- SKILL ENTITLEMENTS: customers see their own
CREATE POLICY "Customers view own entitlements" ON public.skill_entitlements
  FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Admin full access entitlements" ON public.skill_entitlements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- SHIPMENTS: customers see their own (via order)
CREATE POLICY "Customers view own shipments" ON public.shipments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = shipments.order_id AND orders.customer_id = auth.uid())
  );
CREATE POLICY "Admin full access shipments" ON public.shipments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- LEADS: admin only
CREATE POLICY "Admin full access leads" ON public.leads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- CONTACT HISTORY: admin only
CREATE POLICY "Admin full access contact history" ON public.contact_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ANALYTICS EVENTS: insert by anyone (anon), read by admin only
CREATE POLICY "Anyone can insert analytics" ON public.analytics_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin read analytics" ON public.analytics_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- INVOICES: customers see their own, admins see all
CREATE POLICY "Customers view own invoices" ON public.invoices
  FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Admin full access invoices" ON public.invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- TAX RATES: public read, admin write
CREATE POLICY "Anyone can read tax rates" ON public.tax_rates
  FOR SELECT USING (true);
CREATE POLICY "Admin manage tax rates" ON public.tax_rates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

### Supabase Auth Trigger (auto-create profile on signup)

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## FILE PLAN: WHAT EACH AGENT CREATES

### Shared Infrastructure (Agent 1 creates, all agents use)

```
src/lib/
  supabase/
    client.ts              -- Browser Supabase client (singleton)
    server.ts              -- Server-side Supabase client (uses service role key)
    middleware.ts           -- Supabase auth middleware for Next.js
  types/
    supabase.ts            -- Generated types (npx supabase gen types)
    index.ts               -- Re-exports + manual type additions
```

### Environment Variables (add to .env.local)

```
# Supabase (Agent 1 adds)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Existing (DO NOT TOUCH)
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

---

## AGENT 1: DATABASE SCHEMA

**Owns**: Supabase project creation, all SQL migrations, generated types, Supabase client utilities.

**Creates**:
```
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/supabase/middleware.ts
src/lib/types/supabase.ts
src/lib/types/index.ts
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_auth_trigger.sql
supabase/migrations/004_seed_products.sql
```

**Read/Write access**: All tables (creates them all).

**Interface contract**: After Agent 1 completes, `src/lib/types/supabase.ts` contains generated types that all other agents import. `src/lib/supabase/server.ts` exports `createServerClient()` and `createServiceRoleClient()`.

```typescript
// src/lib/supabase/server.ts — Agent 1's key export
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/types/supabase';

export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function createServerClient(accessToken?: string) {
  // For authenticated requests — uses anon key + user's JWT
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    accessToken ? {
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    } : undefined
  );
}
```

```typescript
// src/lib/supabase/client.ts — Browser client
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/lib/types/supabase';

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Seed data** (004_seed_products.sql):
```sql
INSERT INTO public.products (slug, name, description, price_cents, product_type) VALUES
  ('phone-a16', 'OpenClaw Phone — Samsung Galaxy A16 5G', 'Brand new Samsung Galaxy A16 5G with OpenClaw pre-installed', 22500, 'phone'),
  ('full-package', 'OpenClaw Full Agent Package', 'Phone + 5 skills + 90-min onboarding + 30 days priority support', 129900, 'package');

-- Insert all 51 skills from marketplace
INSERT INTO public.products (slug, name, description, price_cents, product_type, category) VALUES
  ('lead-scraper', 'Lead Scraper', 'Scrapes targeted business leads...', 4900, 'skill', 'lead-gen'),
  ('sms-outreach-engine', 'SMS Outreach Engine', 'Automated text message campaigns...', 4900, 'skill', 'lead-gen')
  -- ... all 51 skills
;
```

---

## AGENT 2: AUTH

**Owns**: Authentication flows, session management, middleware, protected route helpers.

**Creates**:
```
src/lib/auth/
  actions.ts               -- Server actions: signUp, signIn, signOut, resetPassword
  session.ts               -- getSession(), getCurrentUser(), requireAuth(), requireAdmin()
  device-token.ts           -- generateDeviceToken(), registerDevice()
src/app/api/auth/
  register/route.ts        -- POST: email/password signup
  login/route.ts           -- POST: email/password login
  logout/route.ts          -- POST: clear session
  reset-password/route.ts  -- POST: send reset email
  device/route.ts          -- POST: register device token, GET: list user devices
src/app/(auth)/
  login/page.tsx           -- Login form
  register/page.tsx        -- Registration form
  reset-password/page.tsx  -- Password reset form
src/middleware.ts           -- Next.js middleware for auth (protected routes)
```

**Tables this agent reads/writes**:
- `profiles` — READ/WRITE (user profile on signup)
- `devices` — READ/WRITE (device registration)

**Interface contract**:

```typescript
// src/lib/auth/session.ts — Key exports other agents use
export async function getSession(): Promise<Session | null>;
export async function getCurrentUser(): Promise<Profile | null>;
export async function requireAuth(): Promise<Profile>;        // throws redirect to /login
export async function requireAdmin(): Promise<Profile>;       // throws redirect to /login if not admin
```

```typescript
// src/lib/auth/device-token.ts
export function generateDeviceToken(): string;                // crypto.randomUUID()
export async function registerDevice(customerId: string, token: string): Promise<Device>;
export async function validateDeviceToken(token: string): Promise<Device | null>;
```

**API Contracts**:

```
POST /api/auth/register
  Body: { email, password, full_name, phone? }
  Response: { user: Profile } | { error: string }

POST /api/auth/login
  Body: { email, password }
  Response: { user: Profile, session: Session } | { error: string }

POST /api/auth/logout
  Response: { success: true }

POST /api/auth/device
  Headers: Authorization: Bearer <jwt>
  Body: { device_token, phone_model?, openclaw_version? }
  Response: { device: Device }

GET /api/auth/device
  Headers: Authorization: Bearer <jwt>
  Response: { devices: Device[] }
```

---

## AGENT 3: ORDERS & CHECKOUT

**Owns**: Order persistence, order history, order status updates. Extends the existing webhook.

**Creates**:
```
src/lib/orders/
  create-order.ts          -- createOrderFromStripeSession()
  order-queries.ts         -- getOrder(), getOrdersByCustomer(), getOrdersByEmail()
  order-number.ts          -- generateOrderNumber() -> "CLF-20260324-A1B2"
src/app/api/orders/
  route.ts                 -- GET: list orders (authenticated)
  [id]/route.ts            -- GET: single order detail
  [id]/status/route.ts     -- PATCH: update order status (admin only)
src/app/orders/
  page.tsx                 -- Order history page (authenticated)
  [id]/page.tsx            -- Single order detail page
```

**CRITICAL**: Agent 3 modifies `src/app/api/webhook/route.ts` to ADD order persistence AFTER the existing Telegram notification. Does NOT remove or change existing Telegram logic.

**Tables this agent reads/writes**:
- `orders` — READ/WRITE
- `order_items` — READ/WRITE
- `profiles` — READ (lookup customer by email)
- `products` — READ (resolve product IDs)

**Interface contract**:

```typescript
// src/lib/orders/create-order.ts
export async function createOrderFromStripeSession(
  session: Stripe.Checkout.Session
): Promise<Order>;

// src/lib/orders/order-queries.ts
export async function getOrder(orderId: string): Promise<OrderWithItems | null>;
export async function getOrdersByCustomer(customerId: string): Promise<Order[]>;
export async function getOrdersByEmail(email: string): Promise<Order[]>;
```

**Webhook extension pattern** (how Agent 3 modifies the webhook):

```typescript
// In webhook/route.ts, AFTER the existing sendTelegram() call:
case "checkout.session.completed": {
  // ... existing Telegram code stays exactly as-is ...
  await sendTelegram(message);          // EXISTING LINE

  // NEW: Persist order to Supabase
  try {
    await createOrderFromStripeSession(session);
  } catch (err) {
    console.error("[ORDER DB] Failed to persist order:", err);
    // Don't fail the webhook — Telegram already sent
  }
  break;
}
```

**API Contracts**:

```
GET /api/orders
  Headers: Authorization: Bearer <jwt>
  Query: ?page=1&limit=20
  Response: { orders: Order[], total: number }

GET /api/orders/[id]
  Headers: Authorization: Bearer <jwt>
  Response: { order: OrderWithItems }

PATCH /api/orders/[id]/status
  Headers: Authorization: Bearer <jwt> (admin)
  Body: { status: "processing" | "shipped" | "delivered" | etc. }
  Response: { order: Order }
```

---

## AGENT 4: CRM

**Owns**: Lead management, contact history, customer views for admin.

**Creates**:
```
src/lib/crm/
  lead-queries.ts          -- CRUD for leads
  contact-queries.ts       -- CRUD for contact history
  customer-queries.ts      -- Customer aggregate views (orders + leads + contacts)
src/app/api/crm/
  leads/route.ts           -- GET: list leads, POST: create lead
  leads/[id]/route.ts      -- GET/PATCH/DELETE single lead
  contacts/route.ts        -- GET: list contacts, POST: log contact
  contacts/[id]/route.ts   -- GET single contact entry
  customers/route.ts       -- GET: customer list with aggregated data
  customers/[id]/route.ts  -- GET: full customer profile
```

**Tables this agent reads/writes**:
- `leads` — READ/WRITE
- `contact_history` — READ/WRITE
- `profiles` — READ (customer data)
- `orders` — READ (for customer aggregate view)

**Interface contract**:

```typescript
// src/lib/crm/lead-queries.ts
export async function getLeads(filters?: LeadFilters): Promise<{ leads: Lead[], total: number }>;
export async function getLead(id: string): Promise<Lead | null>;
export async function createLead(data: CreateLeadInput): Promise<Lead>;
export async function updateLead(id: string, data: UpdateLeadInput): Promise<Lead>;
export async function deleteLead(id: string): Promise<void>;

// src/lib/crm/customer-queries.ts
export async function getCustomerProfile(id: string): Promise<CustomerProfile>;
// CustomerProfile = Profile + orders[] + contact_history[] + skill_entitlements[]
```

**API Contracts**:

```
GET /api/crm/leads?status=new&page=1&limit=20
POST /api/crm/leads         Body: { email, phone, full_name, company, source }
GET /api/crm/leads/[id]
PATCH /api/crm/leads/[id]   Body: { status, notes, ... }
DELETE /api/crm/leads/[id]

POST /api/crm/contacts       Body: { lead_id?, customer_id?, channel, direction, subject, body }
GET /api/crm/contacts?lead_id=xxx | ?customer_id=xxx

GET /api/crm/customers?page=1&limit=20&search=term
GET /api/crm/customers/[id]
```

All CRM routes require admin auth.

---

## AGENT 5: ANALYTICS

**Owns**: Event tracking, dashboard metrics, conversion funnel data.

**Creates**:
```
src/lib/analytics/
  track.ts                 -- trackEvent() — server-side event logging
  track-client.ts          -- useAnalytics() hook — client-side event tracking
  metrics.ts               -- Dashboard metric queries (revenue, orders, conversions)
  funnel.ts                -- Conversion funnel analysis
src/app/api/analytics/
  track/route.ts           -- POST: log analytics event (public, no auth)
  dashboard/route.ts       -- GET: dashboard metrics (admin only)
  funnel/route.ts          -- GET: conversion funnel data (admin only)
  revenue/route.ts         -- GET: revenue over time (admin only)
src/components/analytics/
  AnalyticsProvider.tsx     -- Client component that tracks page views
```

**Tables this agent reads/writes**:
- `analytics_events` — READ/WRITE
- `orders` — READ (for revenue/conversion metrics)
- `order_items` — READ (for product-level metrics)
- `products` — READ (for product names in reports)

**Interface contract**:

```typescript
// src/lib/analytics/track.ts — Server-side
export async function trackEvent(event: AnalyticsEvent): Promise<void>;

// src/lib/analytics/track-client.ts — Client-side hook
export function useAnalytics(): {
  trackPageView: (url: string) => void;
  trackAddToCart: (productId: string, price: number) => void;
  trackCheckoutStart: (totalCents: number) => void;
  trackPurchase: (orderId: string, totalCents: number) => void;
};

// src/lib/analytics/metrics.ts
export async function getDashboardMetrics(dateRange: DateRange): Promise<DashboardMetrics>;
// DashboardMetrics = { totalRevenue, orderCount, avgOrderValue, conversionRate, topProducts }

export async function getRevenueTimeSeries(dateRange: DateRange, interval: 'day' | 'week' | 'month'): Promise<TimeSeriesData[]>;
```

**API Contracts**:

```
POST /api/analytics/track
  Body: { event_type, session_id?, page_url?, referrer?, utm_source?, utm_medium?, utm_campaign?, properties? }
  Response: { success: true }
  Auth: NONE (public endpoint, rate-limited)

GET /api/analytics/dashboard?from=2026-03-01&to=2026-03-24
  Auth: Admin
  Response: { totalRevenue, orderCount, avgOrderValue, conversionRate, topProducts[], recentOrders[] }

GET /api/analytics/revenue?from=2026-01-01&to=2026-03-24&interval=week
  Auth: Admin
  Response: { series: [{ date, revenue, orders }] }

GET /api/analytics/funnel?from=2026-03-01&to=2026-03-24
  Auth: Admin
  Response: { steps: [{ name, count, rate }] }
  // page_view -> add_to_cart -> checkout_start -> purchase
```

---

## AGENT 6: ACCOUNTING

**Owns**: Invoice generation, tax calculations, revenue reports.

**Creates**:
```
src/lib/accounting/
  invoice.ts               -- createInvoice(), getInvoice(), generateInvoicePDF()
  tax.ts                   -- calculateTax(), getTaxRate()
  revenue.ts               -- getRevenueReport(), getRevenueByProduct()
  invoice-number.ts        -- generateInvoiceNumber() -> "INV-20260324-XXXX"
src/app/api/accounting/
  invoices/route.ts        -- GET: list invoices (admin), POST: create invoice
  invoices/[id]/route.ts   -- GET: single invoice
  invoices/[id]/pdf/route.ts -- GET: download invoice PDF
  tax-rates/route.ts       -- GET: list tax rates, POST/PUT: manage tax rates (admin)
  revenue/route.ts         -- GET: revenue summary (admin)
```

**Tables this agent reads/writes**:
- `invoices` — READ/WRITE
- `tax_rates` — READ/WRITE
- `orders` — READ (to generate invoices from orders)
- `order_items` — READ (line items for invoices)
- `profiles` — READ (customer info on invoices)

**Interface contract**:

```typescript
// src/lib/accounting/tax.ts
export async function calculateTax(stateCde: string, subtotalCents: number): Promise<{
  taxCents: number;
  taxRate: number;
  jurisdiction: string;
}>;
export async function getTaxRate(stateCode: string): Promise<number>;

// src/lib/accounting/invoice.ts
export async function createInvoiceForOrder(orderId: string): Promise<Invoice>;
export async function getInvoice(invoiceId: string): Promise<Invoice | null>;
export async function generateInvoicePDF(invoiceId: string): Promise<Buffer>;
```

**API Contracts**:

```
GET /api/accounting/invoices?page=1&limit=20&status=paid
  Auth: Admin
  Response: { invoices: Invoice[], total: number }

POST /api/accounting/invoices
  Auth: Admin
  Body: { order_id: string }
  Response: { invoice: Invoice }

GET /api/accounting/invoices/[id]
  Auth: Admin or owning customer
  Response: { invoice: InvoiceWithLineItems }

GET /api/accounting/invoices/[id]/pdf
  Auth: Admin or owning customer
  Response: PDF file (Content-Type: application/pdf)

GET /api/accounting/tax-rates
  Response: { rates: TaxRate[] }

GET /api/accounting/revenue?from=2026-01-01&to=2026-03-24&group_by=month
  Auth: Admin
  Response: { periods: [{ period, gross, tax, net, orderCount }] }
```

---

## AGENT 7: SHIPPING

**Owns**: Shipment creation, tracking status, fulfillment workflows.

**Creates**:
```
src/lib/shipping/
  shipment.ts              -- createShipment(), updateShipment(), getShipmentByOrder()
  tracking.ts              -- updateTrackingStatus(), getTrackingInfo()
  carriers.ts              -- Carrier constants and tracking URL generators
src/app/api/shipping/
  route.ts                 -- GET: list shipments (admin)
  [id]/route.ts            -- GET: single shipment, PATCH: update shipment
  order/[orderId]/route.ts -- GET: shipments for an order
  track/[trackingNumber]/route.ts -- GET: public tracking lookup
```

**Tables this agent reads/writes**:
- `shipments` — READ/WRITE
- `orders` — READ/WRITE (updates order status to 'shipped' / 'delivered')

**Interface contract**:

```typescript
// src/lib/shipping/shipment.ts
export async function createShipment(data: CreateShipmentInput): Promise<Shipment>;
export async function updateShipment(id: string, data: UpdateShipmentInput): Promise<Shipment>;
export async function getShipmentByOrder(orderId: string): Promise<Shipment | null>;
export async function getShipments(filters?: ShipmentFilters): Promise<{ shipments: Shipment[], total: number }>;

// src/lib/shipping/carriers.ts
export function getTrackingUrl(carrier: string, trackingNumber: string): string;
export const CARRIERS = ['usps', 'ups', 'fedex'] as const;
```

**API Contracts**:

```
GET /api/shipping?status=in_transit&page=1&limit=20
  Auth: Admin
  Response: { shipments: ShipmentWithOrder[], total: number }

GET /api/shipping/[id]
  Auth: Admin
  Response: { shipment: ShipmentWithOrder }

PATCH /api/shipping/[id]
  Auth: Admin
  Body: { carrier?, tracking_number?, status?, shipped_at?, delivered_at? }
  Response: { shipment: Shipment }
  Side effect: If status changes to 'shipped' or 'delivered', also updates orders.status

GET /api/shipping/order/[orderId]
  Auth: Admin or owning customer
  Response: { shipment: Shipment | null }

GET /api/shipping/track/[trackingNumber]
  Auth: NONE (public tracking page)
  Response: { shipment: { status, carrier, tracking_url, shipped_at, delivered_at } }
```

---

## AGENT 8: ADMIN DASHBOARD

**Owns**: Admin UI pages, dashboard components, data visualization. Does NOT create API routes (uses routes from agents 3-7).

**Creates**:
```
src/app/admin/
  layout.tsx               -- Admin layout with sidebar nav + auth guard
  page.tsx                 -- Dashboard overview (metrics, recent orders, charts)
  orders/
    page.tsx               -- Orders list with filters
    [id]/page.tsx          -- Order detail + status management
  customers/
    page.tsx               -- Customer list
    [id]/page.tsx          -- Customer profile (orders, contacts, entitlements)
  leads/
    page.tsx               -- Lead management
    [id]/page.tsx          -- Lead detail + contact history
  shipping/
    page.tsx               -- Shipment management
  invoices/
    page.tsx               -- Invoice list
  analytics/
    page.tsx               -- Analytics dashboard (charts, funnels)
  products/
    page.tsx               -- Product management
  settings/
    page.tsx               -- Tax rates, config
src/components/admin/
  AdminSidebar.tsx         -- Sidebar navigation
  AdminHeader.tsx          -- Top bar with user info
  StatsCard.tsx            -- Metric display card
  DataTable.tsx            -- Reusable sortable/filterable table
  StatusBadge.tsx          -- Order/shipment/lead status badges
  RevenueChart.tsx         -- Revenue over time chart
  FunnelChart.tsx          -- Conversion funnel visualization
  Pagination.tsx           -- Pagination controls
```

**Tables this agent reads (via API calls, not direct)**:
- Agent 8 calls the API routes created by Agents 3-7. It does NOT import `lib/` functions directly for data.
- Exception: It does import `requireAdmin()` from Agent 2's `src/lib/auth/session.ts` for the layout auth guard.

**API endpoints Agent 8 consumes**:
```
GET /api/orders                    (Agent 3)
GET /api/orders/[id]               (Agent 3)
PATCH /api/orders/[id]/status      (Agent 3)
GET /api/crm/leads                 (Agent 4)
GET /api/crm/customers             (Agent 4)
GET /api/crm/customers/[id]        (Agent 4)
GET /api/analytics/dashboard       (Agent 5)
GET /api/analytics/revenue         (Agent 5)
GET /api/analytics/funnel          (Agent 5)
GET /api/accounting/invoices       (Agent 6)
GET /api/accounting/revenue        (Agent 6)
GET /api/shipping                  (Agent 7)
PATCH /api/shipping/[id]           (Agent 7)
```

---

## DEPENDENCY GRAPH

```
Agent 1 (Schema) ─────────────> MUST COMPLETE FIRST
   │
   ├── Agent 2 (Auth) ──────────> CAN START after Agent 1
   │      │
   │      └── All other agents need auth helpers
   │
   ├── Agent 3 (Orders) ────────> NEEDS Agent 1 types + Agent 2 auth
   ├── Agent 4 (CRM) ──────────> NEEDS Agent 1 types + Agent 2 auth
   ├── Agent 5 (Analytics) ────> NEEDS Agent 1 types + Agent 2 auth
   ├── Agent 6 (Accounting) ───> NEEDS Agent 1 types + Agent 2 auth
   ├── Agent 7 (Shipping) ─────> NEEDS Agent 1 types + Agent 2 auth
   │
   └── Agent 8 (Admin UI) ─────> NEEDS ALL API routes from Agents 3-7
```

**Parallel execution strategy**:
1. **Phase 1**: Agent 1 runs alone (creates schema, types, client utilities)
2. **Phase 2**: Agent 2 runs alone (creates auth, needs Agent 1's types/client)
3. **Phase 3**: Agents 3, 4, 5, 6, 7 run IN PARALLEL (each has isolated routes + lib dirs)
4. **Phase 4**: Agent 8 runs last (consumes all API routes)

Phases 1+2 take ~10 minutes. Phase 3 is fully parallel. Phase 4 is the final assembly.

---

## CONFLICT PREVENTION RULES

### File ownership is absolute
- If a file path is listed under an agent, ONLY that agent touches it.
- Exception: Agent 3 modifies `src/app/api/webhook/route.ts` (existing file), but only APPENDS to the `checkout.session.completed` case.

### No cross-agent lib imports
- Agents 3-7 may import from:
  - `src/lib/supabase/*` (Agent 1)
  - `src/lib/auth/session.ts` (Agent 2)
  - `src/lib/types/*` (Agent 1)
- Agents 3-7 must NOT import from each other's `src/lib/<module>/` directories.
- Agent 8 only imports `requireAdmin()` from auth. For data, it calls API routes via `fetch()`.

### API route namespacing
```
/api/checkout/*     -- EXISTING (hands off)
/api/webhook/*      -- EXISTING (Agent 3 extends carefully)
/api/auth/*         -- Agent 2
/api/orders/*       -- Agent 3
/api/crm/*          -- Agent 4
/api/analytics/*    -- Agent 5
/api/accounting/*   -- Agent 6
/api/shipping/*     -- Agent 7
```
No overlaps possible.

### Package dependencies
All agents share the same `package.json`. New deps each agent adds:

| Agent | Package | Why |
|-------|---------|-----|
| 1 | `@supabase/supabase-js`, `@supabase/ssr` | Supabase client |
| 2 | (none, uses Agent 1's packages) | |
| 3 | (none) | |
| 4 | (none) | |
| 5 | (none) | |
| 6 | (none — PDF gen via simple HTML-to-buffer, no heavy lib) | |
| 7 | (none) | |
| 8 | `recharts` | Charts for admin dashboard |

Only 2 new dependencies total: `@supabase/supabase-js` + `@supabase/ssr` + `recharts`.

---

## COMPLETE FILE TREE (post-build)

```
src/
  app/
    api/
      checkout/route.ts              [EXISTING - DO NOT MODIFY]
      webhook/route.ts               [EXISTING - Agent 3 EXTENDS]
      auth/
        register/route.ts            [Agent 2]
        login/route.ts               [Agent 2]
        logout/route.ts              [Agent 2]
        reset-password/route.ts      [Agent 2]
        device/route.ts              [Agent 2]
      orders/
        route.ts                     [Agent 3]
        [id]/
          route.ts                   [Agent 3]
          status/route.ts            [Agent 3]
      crm/
        leads/
          route.ts                   [Agent 4]
          [id]/route.ts              [Agent 4]
        contacts/
          route.ts                   [Agent 4]
          [id]/route.ts              [Agent 4]
        customers/
          route.ts                   [Agent 4]
          [id]/route.ts              [Agent 4]
      analytics/
        track/route.ts               [Agent 5]
        dashboard/route.ts           [Agent 5]
        funnel/route.ts              [Agent 5]
        revenue/route.ts             [Agent 5]
      accounting/
        invoices/
          route.ts                   [Agent 6]
          [id]/
            route.ts                 [Agent 6]
            pdf/route.ts             [Agent 6]
        tax-rates/route.ts           [Agent 6]
        revenue/route.ts             [Agent 6]
      shipping/
        route.ts                     [Agent 7]
        [id]/route.ts                [Agent 7]
        order/[orderId]/route.ts     [Agent 7]
        track/[trackingNumber]/route.ts [Agent 7]
    (auth)/
      login/page.tsx                 [Agent 2]
      register/page.tsx              [Agent 2]
      reset-password/page.tsx        [Agent 2]
    admin/
      layout.tsx                     [Agent 8]
      page.tsx                       [Agent 8]
      orders/
        page.tsx                     [Agent 8]
        [id]/page.tsx                [Agent 8]
      customers/
        page.tsx                     [Agent 8]
        [id]/page.tsx                [Agent 8]
      leads/
        page.tsx                     [Agent 8]
        [id]/page.tsx                [Agent 8]
      shipping/page.tsx              [Agent 8]
      invoices/page.tsx              [Agent 8]
      analytics/page.tsx             [Agent 8]
      products/page.tsx              [Agent 8]
      settings/page.tsx              [Agent 8]
    orders/
      page.tsx                       [Agent 3]
      [id]/page.tsx                  [Agent 3]
    cart/page.tsx                     [EXISTING - DO NOT MODIFY]
    marketplace/page.tsx             [EXISTING - DO NOT MODIFY]
    success/page.tsx                 [EXISTING - DO NOT MODIFY]
    page.tsx                         [EXISTING - DO NOT MODIFY]
    layout.tsx                       [EXISTING - DO NOT MODIFY]
    globals.css                      [EXISTING - DO NOT MODIFY]
  lib/
    supabase/
      client.ts                      [Agent 1]
      server.ts                      [Agent 1]
      middleware.ts                  [Agent 1]
    types/
      supabase.ts                    [Agent 1]
      index.ts                       [Agent 1]
    auth/
      actions.ts                     [Agent 2]
      session.ts                     [Agent 2]
      device-token.ts                [Agent 2]
    orders/
      create-order.ts                [Agent 3]
      order-queries.ts               [Agent 3]
      order-number.ts                [Agent 3]
    crm/
      lead-queries.ts                [Agent 4]
      contact-queries.ts             [Agent 4]
      customer-queries.ts            [Agent 4]
    analytics/
      track.ts                       [Agent 5]
      track-client.ts                [Agent 5]
      metrics.ts                     [Agent 5]
      funnel.ts                      [Agent 5]
    accounting/
      invoice.ts                     [Agent 6]
      tax.ts                         [Agent 6]
      revenue.ts                     [Agent 6]
      invoice-number.ts              [Agent 6]
    shipping/
      shipment.ts                    [Agent 7]
      tracking.ts                    [Agent 7]
      carriers.ts                    [Agent 7]
  components/
    analytics/
      AnalyticsProvider.tsx          [Agent 5]
    admin/
      AdminSidebar.tsx               [Agent 8]
      AdminHeader.tsx                [Agent 8]
      StatsCard.tsx                  [Agent 8]
      DataTable.tsx                  [Agent 8]
      StatusBadge.tsx                [Agent 8]
      RevenueChart.tsx               [Agent 8]
      FunnelChart.tsx                [Agent 8]
      Pagination.tsx                 [Agent 8]
    CartProvider.tsx                  [EXISTING - DO NOT MODIFY]
    CartIcon.tsx                     [EXISTING - DO NOT MODIFY]
    FAQ.tsx                          [EXISTING - DO NOT MODIFY]
    FeatureGrid.tsx                  [EXISTING - DO NOT MODIFY]
    Footer.tsx                       [EXISTING - DO NOT MODIFY]
    Navbar.tsx                       [EXISTING - DO NOT MODIFY]
    PhoneScene.tsx                   [EXISTING - DO NOT MODIFY]
    PhoneShowcase.tsx                [EXISTING - DO NOT MODIFY]
    PricingCard.tsx                  [EXISTING - DO NOT MODIFY]
    TerminalDemo.tsx                 [EXISTING - DO NOT MODIFY]
  middleware.ts                      [Agent 2]
supabase/
  migrations/
    001_initial_schema.sql           [Agent 1]
    002_rls_policies.sql             [Agent 1]
    003_auth_trigger.sql             [Agent 1]
    004_seed_products.sql            [Agent 1]
```

**Total new files: ~65**
**Existing files modified: 1** (webhook/route.ts by Agent 3)
**Existing files untouched: 14**

---

## QUICK REFERENCE: AGENT CHEAT SHEET

| Agent | Module | API Prefix | Lib Dir | Tables (Write) | Tables (Read) |
|-------|--------|------------|---------|-----------------|---------------|
| 1 | Schema | n/a | `lib/supabase/`, `lib/types/` | ALL (creates) | ALL |
| 2 | Auth | `/api/auth/` | `lib/auth/` | profiles, devices | profiles, devices |
| 3 | Orders | `/api/orders/` | `lib/orders/` | orders, order_items | profiles, products |
| 4 | CRM | `/api/crm/` | `lib/crm/` | leads, contact_history | profiles, orders |
| 5 | Analytics | `/api/analytics/` | `lib/analytics/` | analytics_events | orders, order_items, products |
| 6 | Accounting | `/api/accounting/` | `lib/accounting/` | invoices, tax_rates | orders, order_items, profiles |
| 7 | Shipping | `/api/shipping/` | `lib/shipping/` | shipments, orders (status only) | orders |
| 8 | Admin UI | n/a (pages) | n/a | none (uses APIs) | all (via fetch) |

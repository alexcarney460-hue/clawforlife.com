import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';

/**
 * Admin Supabase client using the service role key.
 * This client bypasses ALL Row Level Security policies.
 *
 * Use ONLY for:
 * - Webhook handlers (Stripe callbacks)
 * - Admin API routes (after verifying admin role)
 * - Background jobs / cron tasks
 * - Seeding or migration scripts
 *
 * NEVER expose this client to the browser or pass it to client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * `import 'server-only'` at the top is deliberate: if any of this ever gets
 * pulled into a client component, the build fails rather than shipping the key
 * to the browser. That is a better failure than the alternative.
 *
 * Use this ONLY for work the customer cannot be trusted to do themselves:
 * pricing a cart, writing orders, moving stock, guest order lookup.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser client. Runs as `anon` or, once signed in, `authenticated`.
 * Every read it makes is filtered by the RLS policies in 002_rls.sql —
 * which is the point. Nothing here can see another customer's data.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

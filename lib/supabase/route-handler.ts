import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * For use inside Route Handlers (app/api/**\/route.ts) only. Route Handlers
 * run in a request/response context, so unlike a Server Component this
 * client can actually set and clear cookies -- it is the one that signs
 * people in, out, and through a password reset.
 *
 * Runs as `anon`, then as whatever the auth call just established. It is not
 * the service-role client: RLS still applies, which is the point everywhere
 * except the auth calls themselves (signUp/signInWithPassword/etc. talk to
 * Supabase Auth directly, not through PostgREST, so RLS does not enter into
 * those specifically).
 */
export async function createRouteHandlerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
}

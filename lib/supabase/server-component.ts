import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * For use inside Server Components and other read-only server contexts.
 * Next.js forbids writing cookies outside a Route Handler or Server Action,
 * so setAll here is a no-op -- session refresh is middleware's job (see
 * lib/supabase/middleware.ts), not this client's. Reads still run as
 * whichever role the request's session cookie belongs to, so RLS applies
 * exactly as it would for that user anywhere else.
 */
export async function createServerComponentClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // No-op by design -- see the note above.
        },
      },
    },
  );
}

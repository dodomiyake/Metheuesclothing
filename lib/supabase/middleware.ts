import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session cookie on every request.
 *
 * Server Components cannot write cookies (Next.js forbids it), so if nothing
 * else did this, a session nearing its access-token expiry would go stale on
 * every route that only renders Server Components -- signed in one request,
 * silently signed out a few minutes later with no error, just RLS returning
 * nothing. Middleware runs before every request and can write cookies, so
 * this is the one place a refreshed token actually gets saved.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not remove: this is what actually triggers the refresh.
  await supabase.auth.getUser();

  return supabaseResponse;
}

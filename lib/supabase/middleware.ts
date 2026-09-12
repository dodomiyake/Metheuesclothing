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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Fail open, deliberately -- same reasoning as lib/rate-limit.ts. This
  // middleware sits in front of nearly every route (the matcher in
  // middleware.ts excludes only static assets), so a missing or bad env var
  // here must not take the whole site down, including pages that touch no
  // Supabase data at all. The cost of failing open is a session that stops
  // refreshing until it's fixed -- recoverable. A middleware crash is not:
  // it was a site-wide 500 the one time this shipped without the guard.
  if (!url || !key) {
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(url, key, {
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
    });

    // Do not remove: this is what actually triggers the refresh.
    await supabase.auth.getUser();
  } catch {
    return NextResponse.next({ request });
  }

  return supabaseResponse;
}

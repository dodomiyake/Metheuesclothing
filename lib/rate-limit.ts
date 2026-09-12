import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Where the caller's IP comes from, and why this is the fragile part.
 *
 * `x-forwarded-for` is a request header, which means the client can send it.
 * It is only trustworthy because Vercel overwrites it at the edge with the real
 * connecting address before the function sees it. Deploy this behind anything
 * that does NOT do that — a bare Node server, a misconfigured proxy — and an
 * attacker changes one header per request and the limit below does nothing at
 * all, silently.
 *
 * If the hosting ever changes, this function is the thing to revisit.
 */
function clientIp(req: NextRequest): string {
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();

  // No IP at all. Rather than letting the request through unlimited, bucket
  // every such request together so they contend with each other.
  return 'unknown';
}

type Limit = { limit: number; windowSeconds: number };

/**
 * Returns a 429 response if the caller is over the limit, or null to continue.
 *
 * `scope` separates the buckets, so hammering the order lookup does not use up
 * someone's checkout allowance.
 */
export async function rateLimit(
  req: NextRequest,
  scope: string,
  { limit, windowSeconds }: Limit,
  extraKey?: string,
): Promise<NextResponse | null> {
  const key = `${scope}:${clientIp(req)}${extraKey ? `:${extraKey}` : ''}`;

  const db = createServiceClient();
  const { data, error } = await db.rpc('rate_limit_hit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  // Fail open, deliberately. If the database is unreachable the limiter cannot
  // answer, and refusing every request would turn a limiter outage into a site
  // outage. The routes behind this all have their own correctness guarantees —
  // server-side pricing, idempotent webhooks — so an unlimited window is a
  // nuisance rather than a hole.
  if (error) return null;

  if (data === false) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(windowSeconds) } },
    );
  }

  return null;
}

/** Shared budgets, named so the numbers are not scattered through the routes. */
export const LIMITS = {
  /** Generous: a real person retrying a declined card should never see 429. */
  checkout: { limit: 10, windowSeconds: 60 },
  /** Tight: this one is guessable by design, so it is the one worth throttling. */
  orderLookup: { limit: 5, windowSeconds: 300 },
  returns: { limit: 5, windowSeconds: 300 },
  newsletter: { limit: 3, windowSeconds: 3600 },
  /** Tight, and keyed by email as well as IP (rateLimit's extraKey) — a
   * guessable credential check, same reasoning as orderLookup. */
  signIn: { limit: 8, windowSeconds: 300 },
  register: { limit: 5, windowSeconds: 3600 },
  passwordReset: { limit: 5, windowSeconds: 3600 },
} as const;

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const NewsletterRequest = z.object({ email: z.string().email() }).strict();

// newsletter_self_insert (002_rls.sql) lets anon insert directly with no
// route at all, but LIMITS.newsletter has sat in lib/rate-limit.ts since it
// was first written with nothing calling it -- a direct browser insert would
// never pass through the limiter, since that only runs against a
// NextRequest on our own server. This route is what actually makes the
// budget mean something.
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, 'newsletter', LIMITS.newsletter);
  if (limited) return limited;

  const parsed = NewsletterRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const db = createServiceClient();
  const { error } = await db
    .from('newsletter_subscribers')
    .upsert(
      { email: parsed.data.email, source: 'footer' },
      { onConflict: 'email', ignoreDuplicates: true },
    );

  // Signing up twice is not an error from the visitor's point of view.
  if (error) {
    return NextResponse.json({ error: 'Could not sign you up. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

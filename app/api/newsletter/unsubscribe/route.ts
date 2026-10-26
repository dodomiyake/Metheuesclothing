import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const UnsubscribeRequest = z.object({ token: z.string().uuid() }).strict();

/**
 * Leaving the mailing list.
 *
 * THIS IS A POST, AND THE LINK IN AN EMAIL MUST NOT BE A GET THAT ACTS.
 * Mail clients and security products fetch the links in a message before
 * a human ever sees it — Outlook's Safe Links, corporate scanners,
 * Gmail's image and link prefetching. A GET that unsubscribes means a
 * scanner unsubscribes people who never clicked, and the first anyone
 * knows is that the list quietly emptied. So /unsubscribe renders a page
 * that says what is about to happen, and this route is what the button
 * on it calls. RFC 8058's One-Click header is a POST for the same reason.
 *
 * IT IS KEYED ON A TOKEN, NEVER AN ADDRESS. A link carrying
 * ?email=someone@example.com lets anyone unsubscribe anyone, and answers
 * "is this person on your list?" to whoever asks — the membership oracle
 * rules 5 and 6 exist to prevent for guest orders, in a new place. A uuid
 * names a subscription and proves nothing about an address somebody
 * guessed. Migration 022 added it, with a default so the addresses
 * collected before today are not stranded without a way out.
 *
 * The SERVICE client, because `newsletter_self_insert` is the only policy
 * on this table and it grants INSERT alone — anon may join and may not
 * read or change anything, which is right. The token is the
 * authorisation; the route is what checks it.
 */
export async function POST(req: NextRequest) {
  // Same budget as signing up. A token is unguessable, so this is not
  // protecting a credential — it is stopping someone hammering the
  // endpoint with random uuids, and keeping one broken mail client from
  // retrying forever.
  const limited = await rateLimit(req, 'newsletter', LIMITS.newsletter);
  if (limited) return limited;

  const parsed = UnsubscribeRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'That unsubscribe link is not valid.' }, { status: 400 });
  }

  const db = createServiceClient();

  // `unsubscribed_at` is only set the FIRST time. Clicking twice must not
  // move the date forward: it is the record of when consent was
  // withdrawn, and that is a fact about a moment rather than about the
  // most recent click.
  const { data, error } = await db
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('unsubscribe_token', parsed.data.token)
    .is('unsubscribed_at', null)
    .select('email')
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: 'Could not remove you just now. Please try again.' },
      { status: 500 },
    );
  }

  // No row updated means either an unknown token or one that was already
  // unsubscribed. Both are reported as success, deliberately: somebody
  // who clicks twice should be told they are off the list, not shown an
  // error that makes them wonder whether it worked. The page has already
  // looked the token up, so a genuinely unknown one never reaches here.
  return NextResponse.json({ ok: true, email: data?.email ?? null });
}

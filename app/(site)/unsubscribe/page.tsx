import Link from 'next/link';
import { ContentPage, ContentSection, ContentText } from '@/components/site/content-page';
import { createServiceClient } from '@/lib/supabase/server';
import { UnsubscribeForm } from './unsubscribe-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Unsubscribe — Metheues Clothings',
  // A page reached from an email, about one person's subscription. It has
  // no business in a search index.
  robots: { index: false, follow: false },
};

/**
 * Leaving the mailing list — the page an unsubscribe link lands on.
 *
 * THERE IS NO FIGMA FRAME FOR THIS. The design file has no unsubscribe
 * screen because it has no marketing email either; `unsubscribed_at` has
 * existed since migration 001, been READ by A20 and the A20 export, and
 * been written by nothing at all. Migration 022 added the token and this
 * is the screen that uses it. Built on `content_page_shell` like
 * /delivery, /our-story and /contact rather than inventing a layout.
 *
 * ARRIVING HERE DOES NOT UNSUBSCRIBE ANYBODY, which is the whole reason
 * the page exists rather than the link going straight to an endpoint.
 * Mail clients and security scanners fetch links before a human sees
 * them; an unsubscribe on GET is an unsubscribe nobody asked for. The
 * page looks the token up and says what is about to happen. The button
 * POSTs.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const token = typeof t === 'string' && /^[0-9a-f-]{36}$/.test(t) ? t : null;

  let email: string | null = null;
  let alreadyOff = false;
  let lookupFailed = false;

  if (token) {
    const db = createServiceClient();
    const { data, error } = await db
      .from('newsletter_subscribers')
      .select('email, unsubscribed_at')
      .eq('unsubscribe_token', token)
      .maybeSingle();

    // A failed query and a token nobody recognises are different things
    // and must not render the same — the catalogue-as-empty-shop mistake
    // this codebase keeps finding. One says try again, the other says the
    // link is spent.
    if (error) {
      lookupFailed = true;
    } else if (data) {
      email = data.email as string;
      alreadyOff = Boolean(data.unsubscribed_at);
    }
  }

  return (
    <ContentPage
      breadcrumb="Email"
      title="Unsubscribe"
      intro="Leaving the mailing list takes one press. Nothing has happened yet."
    >
      <ContentSection heading="Your subscription">
        {lookupFailed ? (
          <ContentText>
            We could not check that link just now — this is a problem at our end, not with your
            link. Try again in a minute, and if it keeps happening write to us from the{' '}
            <Link href="/contact">contact page</Link> and we will take you off by hand.
          </ContentText>
        ) : !token ? (
          <ContentText>
            This page needs the link from one of our emails — it carries the code that says which
            subscription to remove. Open the email again and press Unsubscribe there. If you
            cannot find it, write to us from the <Link href="/contact">contact page</Link>.
          </ContentText>
        ) : !email ? (
          <ContentText>
            That link does not match a subscription. It may already have been used, or the address
            may have been removed another way. Either way there is nothing left to do — but if you
            are still getting email from us, tell us on the{' '}
            <Link href="/contact">contact page</Link> and we will sort it out.
          </ContentText>
        ) : alreadyOff ? (
          <ContentText>
            <strong>{email} is already off the list.</strong> You will not get marketing email
            from us. If something is still arriving it will be about an order you placed —
            confirmations and delivery updates are not marketing and carry on while an order is in
            progress.
          </ContentText>
        ) : (
          <>
            <ContentText>
              This will remove <strong>{email}</strong> from the mailing list. We will stop sending
              you anything promotional.
            </ContentText>
            <UnsubscribeForm token={token} email={email} />
            <ContentText>
              Order confirmations, dispatch notices and refund notices are service messages about
              a purchase rather than marketing, so those still arrive while an order is in
              progress. You can rejoin any time from the form at the bottom of any page.
            </ContentText>
          </>
        )}
      </ContentSection>
    </ContentPage>
  );
}

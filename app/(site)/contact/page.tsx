import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { ContentPage } from '@/components/site/content-page';

export const metadata = {
  title: 'Contact — Metheues Clothings',
  description: 'How to reach Metheues Clothings, and when you will hear back.',
};

/**
 * 34 Contact — Figma 123:6424 Desktop pulled, 123:6261 Tablet and
 * 123:6104 Mobile read through get_metadata. ONE breakpoint, like A12:
 * the 320px side column only exists at 1440, and tablet and mobile both
 * stack the side under the main card in the frames' own order. The only
 * other difference between those two is the name row, which is two
 * across at 768 and stacked at 390 — and the name row is part of the
 * form, which this page does not have.
 *
 * THE FORM IS OMITTED, which is the largest omission any screen in this
 * project has had, so here is the whole reason.
 *
 * A contact form needs three things and this system has TWO of them
 * missing. There is no table to put a message in — no `contact_messages`,
 * nothing resembling one. And there is no screen to read it on: the
 * design file has 23 admin screens, all built, and not one is an inbox.
 *
 * THE THIRD REASON IS GONE and this comment used to give it: that Resend
 * would not send from an unverified domain, citing the
 * `email_delivery_failed` row from order MC-10006. That failure was real
 * in September and has since been fixed — `oluwadamilolaajayi.com` is
 * verified with sending enabled, EMAIL_FROM is
 * `Metheues Clothings <orders@oluwadamilolaajayi.com>`, and every
 * transactional send since 4 October has been DELIVERED (E3, E4, E5, E7,
 * E8 all confirmed against Resend's own log). Email can carry a contact
 * message today. The storage and the inbox are what is missing.
 *
 * So a Send message button today would show someone "thanks, we will be
 * in touch" and drop what they wrote. That is the exact shape this
 * codebase keeps refusing — store_settings having no row, every
 * catalogue page reading a failed query as an empty shop — a real failure
 * wearing the face of success. The design's own side column already
 * gives the channel that does work, so the page leads with it.
 *
 * BUILDING THE FORM PROPERLY is now two things rather than three: a
 * migration for `contact_messages` with its RLS, and an admin inbox
 * screen the design does not draw. It is still a feature rather than a
 * field, and still the owner's to ask for — but it is no longer waiting
 * on anything outside this codebase.
 *
 * ONE THING TO CHECK BEFORE RELYING ON THE ADDRESS THIS PAGE LEADS WITH.
 * `store_settings.contact_email` is on a different domain from the one
 * that sends, and nothing here can prove a mailbox exists behind it. The
 * page tells customers to write there, so someone should send it a test
 * message. A verified SENDING domain says nothing about RECEIVING.
 *
 * THE REGISTERED ADDRESS IS OMITTED for the reason A22 omitted STORE
 * DETAILS: "Metheues Clothings Ltd, Unit 7, Pollard Yard" is not a
 * column anywhere, it is legal content waiting on the same review as the
 * returns and privacy copy, and a placeholder postal address is the one
 * piece of this page a customer might act on by posting something to it.
 *
 * KEPT AS THE DESIGN WROTE THEM: the reply times and the opening hours.
 * Nothing in the system measures or enforces either, but they are the
 * owner's commitments about the owner's own behaviour, which is what a
 * contact page is FOR — the same call 32 Our Story makes about its copy.
 * The email address itself is read from store_settings rather than
 * hardcoded, so A22 can change it and this page follows.
 */
export default async function ContactPage() {
  const supabase = await createServerComponentClient();

  const { data: settings, error } = await supabase
    .from('store_settings')
    .select('contact_email')
    .single();
  if (error) throw new Error(`Could not load contact settings: ${error.message}`);

  const email = settings.contact_email;

  return (
    <ContentPage
      breadcrumb="Contact"
      title="Contact"
      intro="A real person reads every message. One working day for a reply, usually less."
    >
      <div className="mc-contact-columns">
        <div className="mc-contact-card" style={{ gap: 16 }}>
          <p className="mc-contact-card-label">SEND US A MESSAGE</p>

          <p style={{ margin: 0, fontSize: 15, lineHeight: '23px' }}>
            Email us and it comes straight to the person who answers it. There is no form to fill
            in — this way you keep a copy of what you sent, in your own sent items, and you can
            attach a photograph if that is quicker than describing something.
          </p>

          <a
            href={`mailto:${email}`}
            className="mc-button-primary"
            style={{ alignSelf: 'flex-start' }}
          >
            Email {email}
          </a>

          {/* The design's reason select and order-number field. Both are
              real things to tell us; without a form they are guidance
              rather than inputs, which is the honest version of a control
              that would have gone nowhere. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className="mc-contact-card-label">WHAT TO PUT IN IT</p>
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                fontSize: 14,
                lineHeight: '22px',
                color: 'var(--mc-text-muted)',
              }}
            >
              <li>What it is about — an order, a return or refund, a product question, or press.</li>
              <li>
                Your order number if there is one. It looks like MC-10231 and it is on your
                confirmation email. Optional, but it gets you a faster answer.
              </li>
              <li>Anything you can show us. Photographs help more than descriptions.</li>
            </ul>
          </div>

          <p style={{ margin: 0, fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)' }}>
            We use what you send only to answer you. Nothing goes on a marketing list from here.
          </p>
        </div>

        <div className="mc-contact-side">
          <div className="mc-contact-card" style={{ background: 'var(--mc-bg-page)', gap: 12 }}>
            <p className="mc-contact-card-label">WHEN YOU WILL HEAR BACK</p>
            {REPLY_TIMES.map((row) => (
              <div key={row.subject} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, color: 'var(--mc-text-muted)' }}>{row.subject}</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{row.time}</span>
              </div>
            ))}
          </div>

          <div className="mc-contact-card" style={{ gap: 10 }}>
            <p className="mc-contact-card-label">OTHER WAYS TO REACH US</p>
            <p style={{ margin: 0, fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)' }}>
              Monday to Friday, 09:00 to 17:00 UK time. We do not take orders or changes over
              social media — an email leaves a record we can both point at.
            </p>
          </div>

          <div className="mc-contact-card" style={{ gap: 8 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Already ordered?</p>
            <p style={{ margin: 0, fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)' }}>
              Tracking, returns and order details are all in your account — usually faster than
              waiting on a reply.
            </p>
            {/* 123:6537 is a Ghost Button flush to the card's left edge
                (padding-right only), so its label lines up with the copy
                above it rather than sitting 24px in. */}
            <Link
              href="/account/orders"
              className="mc-button-ghost"
              style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
            >
              Go to your orders
            </Link>
          </div>
        </div>
      </div>
    </ContentPage>
  );
}

/** 123:6519–123:6527, kept verbatim. */
const REPLY_TIMES = [
  { subject: 'Order questions', time: 'Within one working day' },
  { subject: 'Returns and refunds', time: 'Within one working day' },
  { subject: 'Wholesale and press', time: 'Two to three working days' },
];

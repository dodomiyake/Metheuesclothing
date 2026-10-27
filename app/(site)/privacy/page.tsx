import Link from 'next/link';
import { ContentPage, ContentSection, ContentText } from '@/components/site/content-page';
import { DraftNotice, DEMO_IDENTITY } from '@/components/site/draft-notice';

export const metadata = {
  title: 'Privacy and Cookie Policy — Metheues Clothings',
};

/**
 * 35 Legal — the privacy half. One of three footer links that had 404'd
 * since the chrome was built.
 *
 * THE CONTENT IS NOT A TEMPLATE. Every claim here was checked against
 * this codebase rather than borrowed: the processors are the four
 * actually in use with their real regions, the retention periods are the
 * ones the system enforces, and the rights described are the ones
 * implemented. `docs/legal/privacy.md` is the source draft and carries
 * the reasoning.
 *
 * TWO DISCLOSURES THAT ONLY EXIST BECAUSE DRAFTING THIS WENT LOOKING.
 * The rate limiter writes IP addresses to `rate_limits` (the key is
 * "<scope>:<ip>"), swept after one day by 006_rate_limits.sql:58 — that
 * is personal data and had never been recorded anywhere. And the
 * unsubscribe route exists at all because `unsubscribed_at` was read by
 * A20 and written by nothing until migration 022.
 *
 * THE ERASURE PARAGRAPH IS NOW TRUE OF THE CODE. It used to describe what
 * we would do by hand, and said so, because deleting a profile cascades to
 * addresses and nulls `orders.profile_id` — turning a sale into a GUEST
 * order rather than anonymising anybody. Migration 023 and A20's erase
 * dialog are what closed it, so the paragraph describes one action a staff
 * member takes rather than a promise about careful handwork.
 *
 * ONE SENTENCE IS NEW AND IS THERE BECAUSE 023 FOUND IT: the audit log
 * holds a permanent reference to any customer who has raised a return, so
 * the database refuses to delete their profile at all. That is the reason
 * erasure is anonymisation and not deletion, which the policy now states
 * rather than leaving to sound like a choice of convenience.
 */
export default function PrivacyPage() {
  return (
    <ContentPage
      breadcrumb="Privacy and Cookie Policy"
      title="Privacy and Cookie Policy"
      intro="What we collect when you shop with us, why, who else sees it and how long we keep it."
    >
      <DraftNotice what="This privacy policy is a working draft." />

      <ContentSection heading="Who we are">
        <ContentText>
          Metheues Clothings sells T-shirts in the United Kingdom. The data controller is{' '}
          {DEMO_IDENTITY.legalName}, company number {DEMO_IDENTITY.companyNumber}, at{' '}
          {DEMO_IDENTITY.address}.
        </ContentText>
        <ContentText>
          For anything in this policy, write to us from the{' '}
          <Link href="/contact">contact page</Link>.
        </ContentText>
      </ContentSection>

      <ContentSection heading="What we collect, and why">
        <ContentText>
          <strong>When you buy something:</strong> your email address, the delivery address you
          give Stripe at checkout, and what you ordered. We keep a snapshot of the delivery address
          on the order itself, so that editing your saved addresses later never changes the record
          of where a past parcel went.
        </ContentText>
        <ContentText>
          <strong>When you create an account:</strong> your email address, and optionally your name
          and phone number — you choose whether to give the last two.
        </ContentText>
        <ContentText>
          <strong>When you save an address:</strong> recipient name, address lines, city, postcode,
          country and optionally a phone number for the courier.
        </ContentText>
        <ContentText>
          <strong>Payment details:</strong> we never see or store your full card number. Stripe
          processes the payment. What comes back to us is the card brand and its last four digits —
          enough to tell you which card a refund went to, and nothing that could be used to charge
          it.
        </ContentText>
        <ContentText>
          <strong>When you ask to return something:</strong> the items, your reason, and any note
          you write us.
        </ContentText>
        <ContentText>
          <strong>When you join the mailing list:</strong> your email address and the time you
          consented.
        </ContentText>
        <ContentText>
          <strong>Automatically, on certain requests:</strong> your IP address, to rate-limit
          sign-ins, registrations, password resets, order lookups, return requests and mailing-list
          sign-ups. This is how we stop someone guessing passwords or harvesting order numbers.
          These records are deleted after one day.
        </ContentText>
      </ContentSection>

      <ContentSection heading="Our legal bases">
        <ContentText>
          Taking and fulfilling your order, your account, saved addresses and order history are all{' '}
          <strong>performance of a contract</strong>. Returns and refunds are that plus our{' '}
          <strong>legal obligations</strong> under consumer law. Rate limiting and fraud prevention
          are our <strong>legitimate interests</strong> in keeping the shop and your account
          secure. Keeping records of orders, refunds and stock movements is a{' '}
          <strong>legal obligation</strong> under tax and accounting rules. Marketing email is{' '}
          <strong>consent</strong>, which you may withdraw at any time.
        </ContentText>
      </ContentSection>

      <ContentSection heading="Who else sees it">
        <ContentText>
          We do not sell your data. We use four processors and only these four:{' '}
          <strong>Supabase</strong> for our database and image storage, in London;{' '}
          <strong>Stripe</strong> for card payment and checkout, which is a controller in its own
          right for payment data; <strong>Resend</strong> for order, dispatch, cancellation, return
          and refund emails, in Ireland; and <strong>Vercel</strong> for hosting the site itself.
          We will also disclose information where the law requires it.
        </ContentText>
      </ContentSection>

      <ContentSection heading="How long we keep things">
        <ContentText>
          <strong>Orders, refunds and the records behind them</strong> are kept for at least six
          years after the end of the relevant financial year, which is what UK tax law requires of
          us.
        </ContentText>
        <ContentText>
          <strong>Our internal audit log is append-only.</strong> Entries recording refunds,
          cancellations, dispatches, stock changes and return requests cannot be edited or deleted
          by anyone, including us — that is the point of it. Entries name the member of staff or
          customer who caused the event and the order or return number involved; they do not
          contain email addresses.
        </ContentText>
        <ContentText>
          <strong>Rate-limiting records, including IP addresses,</strong> are deleted after one
          day. <strong>Your account</strong> is kept until you ask us to close it. The{' '}
          <strong>mailing list</strong> keeps your address until you unsubscribe.
        </ContentText>
      </ContentSection>

      <ContentSection heading="Your rights">
        <ContentText>
          Under UK GDPR you may ask us to give you a copy of your data, correct it, delete it,
          restrict or object to how we use it, or port it elsewhere. You can also complain to the
          Information Commissioner&rsquo;s Office at ico.org.uk.
        </ContentText>
        <ContentText>
          <strong>Access.</strong> We can give you a complete copy of everything we hold against
          your email address — profile, saved addresses, orders and their items, returns and
          refunds — as a single file. Ask us and we will send it within one month.
        </ContentText>
        <ContentText>
          <strong>Correction.</strong> You can change your name, phone number and marketing
          preference yourself under <Link href="/account/details">Account details</Link>. Changing
          the email address on an account is not something the site can do yet; write to us.
        </ContentText>
        <ContentText>
          <strong>Deletion.</strong> We cannot delete the record of a completed order, because tax
          law requires us to keep it. What we can do is disconnect it from you, and that is what
          we do when you ask: your email address is replaced everywhere we hold it with a random
          address that can never receive mail, your name, phone number and marketing preference
          are removed, your saved addresses are deleted, the delivery address on each past order
          is cleared down to the country it went to, and you can no longer sign in. The sale
          itself stands as an anonymous entry in the books. We may ask you to wait until an order
          already paid for has arrived, because until then we need the address to send it.
        </ContentText>
        <ContentText>
          Two things survive this, and we would rather say so than let you discover it. Our{' '}
          <strong>append-only audit log</strong> cannot have entries edited or removed by anyone,
          including us — those entries identify a person by name and an order or return number,
          never by email address, and the database itself refuses to delete an account the log
          refers to. That is why erasure here means making you anonymous rather than deleting a
          row. And <strong>Stripe</strong> keeps its own record of a payment as a controller in its
          own right; erasing that is a separate request to them.
        </ContentText>
      </ContentSection>

      <ContentSection heading="Marketing">
        <ContentText>
          We only send marketing email if you have asked for it. You can turn it off under{' '}
          <Link href="/account/details">Account details</Link>, or from the unsubscribe link in any
          marketing message we send.
        </ContentText>
        <ContentText>
          Order confirmations, dispatch notices, cancellations and refund notices are service
          messages about a purchase you made. They are not marketing, and they carry on while an
          order is in progress.
        </ContentText>
      </ContentSection>

      <ContentSection heading="Cookies, and what we store in your browser">
        <ContentText>
          We do not use advertising or analytics cookies, and there is no tracking pixel on this
          site.
        </ContentText>
        <ContentText>
          <strong>Strictly necessary cookies:</strong> when you sign in we set a session cookie so
          you stay signed in. Stripe sets its own cookies on the checkout page it hosts, for fraud
          prevention.
        </ContentText>
        <ContentText>
          <strong>Browser storage, not cookies:</strong> your shopping bag lives in your own
          browser&rsquo;s local storage and never reaches our servers until you check out. We also
          keep a short list of recently completed order numbers there, so that revisiting an old
          confirmation page does not empty a bag you have refilled since. Both are specific to the
          browser you are using, are not shared with anyone, and clearing your site data removes
          them.
        </ContentText>
      </ContentSection>

      <ContentSection heading="Children">
        <ContentText>
          This shop is not intended for children, and we do not knowingly collect data from anyone
          under 16.
        </ContentText>
      </ContentSection>
    </ContentPage>
  );
}

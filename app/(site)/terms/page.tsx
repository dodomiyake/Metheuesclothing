import Link from 'next/link';
import { ContentPage, ContentSection, ContentText } from '@/components/site/content-page';
import { DraftNotice, DEMO_IDENTITY } from '@/components/site/draft-notice';

export const metadata = {
  title: 'Terms and Conditions — Metheues Clothings',
};

/**
 * 35 Legal — the terms half.
 *
 * THIS IS THE ONE THAT MOST NEEDS A SOLICITOR, which is why the draft
 * notice is not negotiable here: section 11 limits liability and section
 * 13 picks a jurisdiction, and both are placeholders written from
 * general UK consumer law rather than from advice about this business.
 *
 * NO FIGURE IS TYPED INTO THIS PAGE. Delivery charges, the free-delivery
 * threshold and the returns window all live in `store_settings`, and
 * /delivery reads them. Restating them here would create a second place
 * for the number to disagree with the basket, which is the failure
 * /delivery's own comment exists to prevent — so this page links there
 * instead. The 14-day cancellation right is statutory and fixed, so that
 * one is written out.
 *
 * `docs/legal/terms.md` is the source draft and carries the reasoning.
 */
export default function TermsPage() {
  return (
    <ContentPage
      breadcrumb="Terms and Conditions"
      title="Terms and Conditions"
      intro="The terms you buy under. Nothing here affects your legal rights as a consumer."
    >
      <DraftNotice what="These terms are a working draft and are not the terms you bought under." />

      <ContentSection heading="1. Who you are buying from">
        <ContentText>
          The seller is {DEMO_IDENTITY.legalName}, company number{' '}
          {DEMO_IDENTITY.companyNumber}, VAT number {DEMO_IDENTITY.vatNumber}, at{' '}
          {DEMO_IDENTITY.address}. Reach us from the <Link href="/contact">contact page</Link>.
        </ContentText>
        <ContentText>
          By placing an order you accept these terms. Nothing in them affects your legal rights as
          a consumer.
        </ContentText>
      </ContentSection>

      <ContentSection heading="2. Ordering">
        <ContentText>
          Our listings are an invitation to buy, not an offer. A contract forms when we email you
          to confirm your order — not when you pay.
        </ContentText>
        <ContentText>
          We may refuse or cancel an order if the item is out of stock, if the price was wrong, or
          if we suspect fraud. If we cancel after you have paid, we refund you in full. Stock is
          held when you check out, not when you add to your bag, so an item in your bag can sell
          out before you pay.
        </ContentText>
      </ContentSection>

      <ContentSection heading="3. Prices and payment">
        <ContentText>
          All prices are in pounds sterling and <strong>include VAT</strong> at the applicable UK
          rate. The price you pay is the price shown at checkout. Delivery is charged separately
          unless your order qualifies for free delivery — the current charges and the threshold
          are on the <Link href="/delivery">delivery page</Link>, and what is shown there is what
          checkout charges, because both read the same figures.
        </ContentText>
        <ContentText>
          Payment is taken by Stripe; we never see your full card details. If we list something at
          the wrong price we will tell you before dispatching, and you may confirm at the correct
          price or cancel for a full refund.
        </ContentText>
      </ContentSection>

      <ContentSection heading="4. Delivery">
        <ContentText>
          We deliver to the United Kingdom and the Republic of Ireland only. We will dispatch
          within a reasonable time and tell you when we do, with a tracking number where the
          service provides one. Delivery times quoted by a carrier are estimates and not
          guarantees; we do not promise a delivery date. Risk passes to you when the goods are
          delivered to the address you gave us.
        </ContentText>
      </ContentSection>

      <ContentSection heading="5. Cancelling — your 14-day right">
        <ContentText>
          You may cancel an online order for any reason within <strong>14 days</strong> of
          receiving it, under the Consumer Contracts Regulations 2013. Tell us within those 14
          days, then return the goods within 14 days of telling us.
        </ContentText>
        <ContentText>
          We refund what you paid for the goods, plus the basic delivery charge, within 14 days of
          getting them back. If you chose a faster delivery than our standard service, we refund
          the standard rate rather than the premium. Return postage is yours to pay unless the item
          is faulty or we sent the wrong thing.
        </ContentText>
        <ContentText>
          Goods must come back in a resaleable condition. You may handle them as you would in a
          shop; if you reduce their value by doing more than that, we may reduce your refund
          accordingly.
        </ContentText>
      </ContentSection>

      <ContentSection heading="6. Our returns window">
        <ContentText>
          Separately from your statutory 14 days, we accept returns for a longer period as a matter
          of policy. The current window is stated on the{' '}
          <Link href="/delivery">delivery page</Link> and is the period our system actually
          enforces.
        </ContentText>
      </ContentSection>

      <ContentSection heading="7. Faulty or misdescribed goods">
        <ContentText>
          Under the Consumer Rights Act 2015 goods must be as described, fit for purpose and of
          satisfactory quality. <strong>Within 30 days</strong> of delivery you may reject a faulty
          item for a full refund, including delivery both ways. <strong>Up to six months</strong>,
          if a fault appears we will repair or replace it, and if that is not possible you may have
          a refund. <strong>After six months</strong> the same rights apply, but you may be asked
          to show the fault was there at delivery. Nothing in these terms limits these rights.
        </ContentText>
      </ContentSection>

      <ContentSection heading="8. Exchanges">
        <ContentText>
          We do not operate an exchange process. Return the item you do not want under section 5 or
          6, and place a new order for the one you do. This is a practical limitation, not an
          attempt to narrow your rights.
        </ContentText>
      </ContentSection>

      <ContentSection heading="9. Your account">
        <ContentText>
          You are responsible for keeping your password secret and for what happens under your
          account. Tell us if you think someone else has access to it. We may suspend or close an
          account used fraudulently or abusively.
        </ContentText>
      </ContentSection>

      <ContentSection heading="10. Our content">
        <ContentText>
          The designs, photographs, text and artwork on this site belong to us or our licensors.
          You may not reproduce them commercially without permission.
        </ContentText>
      </ContentSection>

      <ContentSection heading="11. Our liability">
        <ContentText>
          We are responsible for loss you suffer that is a foreseeable result of our breaking these
          terms or failing to use reasonable care. We are not liable for loss that was not
          foreseeable, nor for business losses — these terms cover consumer sales only.
        </ContentText>
        <ContentText>
          <strong>
            We do not exclude or limit our liability for death or personal injury caused by our
            negligence, for fraud, or for anything else the law does not allow us to limit.
          </strong>{' '}
          Our liability for the goods themselves is limited to what you paid for them.
        </ContentText>
      </ContentSection>

      <ContentSection heading="12. Events outside our control">
        <ContentText>
          If something beyond our reasonable control delays or prevents us performing, we will tell
          you and the time for performance extends. If the delay is substantial you may cancel and
          have a refund for anything undelivered.
        </ContentText>
      </ContentSection>

      <ContentSection heading="13. Complaints and disputes">
        <ContentText>
          Write to us first, from the <Link href="/contact">contact page</Link>. We aim to resolve
          complaints directly. These terms are governed by the law of{' '}
          {DEMO_IDENTITY.jurisdiction}, whose courts have non-exclusive jurisdiction. If you live
          elsewhere in the UK you may bring proceedings in your own courts.
        </ContentText>
      </ContentSection>

      <ContentSection heading="14. Changes">
        <ContentText>
          We may change these terms. The version in force is the one published when you placed your
          order.
        </ContentText>
      </ContentSection>
    </ContentPage>
  );
}

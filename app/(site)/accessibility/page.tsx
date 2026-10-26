import Link from 'next/link';
import { ContentPage, ContentSection, ContentText } from '@/components/site/content-page';
import { DraftNotice } from '@/components/site/draft-notice';

export const metadata = {
  title: 'Accessibility — Metheues Clothings',
};

/**
 * 35 Legal — the accessibility half, and the least legally fraught of the
 * three: it is a factual description of the site rather than a contract.
 * The Public Sector Bodies Accessibility Regulations 2018 do not apply to
 * a private shop, so there is no statutory format to follow. The duty is
 * the Equality Act 2010 one — reasonable adjustments — and a statement
 * like this is evidence of the effort.
 *
 * WHICH IS EXACTLY WHY THE KNOWN ISSUES SECTION IS NOT OPTIONAL. A
 * statement that overstates conformance is worse than none: it converts
 * an honest work-in-progress into a claim somebody can disprove in one
 * click. Everything listed under "What we have done" is a rule this site
 * is built around and can be checked in the code; everything we know is
 * still wrong is named rather than left to be discovered.
 *
 * TWO OF THE ISSUES THIS PAGE USED TO CARRY HAVE CLOSED since the draft
 * was written — the mismatched photograph was replaced and its
 * description is real — so they are gone from the list rather than left
 * in. The remaining ones are true as of the date shown.
 */
export default function AccessibilityPage() {
  return (
    <ContentPage
      breadcrumb="Accessibility"
      title="Accessibility"
      intro="How this shop is built to work for everyone, and what we know is still wrong with it."
    >
      <DraftNotice what="This accessibility statement is a working draft." />

      <ContentSection heading="Our commitment">
        <ContentText>
          We want this shop to work for everyone, including people using a screen reader,
          navigating by keyboard, or viewing at a large text size. We aim to meet{' '}
          <strong>WCAG 2.2 level AA</strong>.
        </ContentText>
      </ContentSection>

      <ContentSection heading="What we have done">
        <ContentText>
          <strong>Colour is never the only way we show you something.</strong> Every status — sold
          out, low stock, a form error, an order&rsquo;s progress — carries a word, not just a
          colour. Someone who cannot distinguish the colours loses nothing.
        </ContentText>
        <ContentText>
          <strong>Touch targets are at least 44 by 44 pixels:</strong> every button, navigation
          link, quantity control and icon control.
        </ContentText>
        <ContentText>
          <strong>Text contrast meets AA</strong>, and our palette is defined so that the
          combinations which would fail cannot be chosen. Form controls carry a border meeting the
          3:1 contrast WCAG asks of user-interface components, because a white box on a near-white
          page is otherwise invisible.
        </ContentText>
        <ContentText>
          <strong>Everything works from a keyboard.</strong> Where the design uses drag-and-drop to
          reorder things, we added real move-up and move-down buttons beside it — a drag-only
          control cannot be operated from a keyboard at all.
        </ContentText>
        <ContentText>
          <strong>Dialogs behave.</strong> The add-to-bag panel and our confirmation dialogs use
          the browser&rsquo;s own dialog element, so focus is trapped inside them, the page behind
          is inert, and Escape closes them.
        </ContentText>
        <ContentText>
          <strong>Counts and states are announced, not just drawn.</strong> The bag icon&rsquo;s
          item count is part of its accessible name, so it is spoken rather than only seen.
        </ContentText>
        <ContentText>
          <strong>The site is built mobile-first</strong> and checked at 390, 768 and 1440 pixels
          wide. Type sizes step with the screen rather than being fixed, and nothing scrolls
          sideways at any width.
        </ContentText>
      </ContentSection>

      <ContentSection heading="Known issues">
        <ContentText>
          We would rather name these than let you find them.
        </ContentText>
        <ContentText>
          <strong>1. We have not had an independent audit.</strong> The points above are our own
          assessment against WCAG 2.2 AA, applied as the site was built. No external tester or
          assistive-technology user has reviewed it.
        </ContentText>
        <ContentText>
          <strong>2. There is no size guide yet.</strong> We will not publish measurements we have
          not verified against real garments, so sizing information is currently incomplete — for
          everyone, not only for disabled users.
        </ContentText>
        <ContentText>
          <strong>3. Product specifications are incomplete.</strong> Fit, fabric weight,
          composition and country of origin are not yet filled in, so a screen reader finds the
          same gaps a sighted reader does.
        </ContentText>
      </ContentSection>

      <ContentSection heading="If something does not work">
        <ContentText>
          Please tell us — it is the fastest way for us to fix it, and we will not treat it as a
          complaint. Write to us from the <Link href="/contact">contact page</Link>, including the
          page you were on and what happened. If you need something from this site in a different
          format, ask and we will find a way to get it to you.
        </ContentText>
      </ContentSection>

      <ContentSection heading="Enforcement">
        <ContentText>
          If you are not happy with how we respond, you can contact the Equality Advisory and
          Support Service at equalityadvisoryservice.com.
        </ContentText>
      </ContentSection>
    </ContentPage>
  );
}

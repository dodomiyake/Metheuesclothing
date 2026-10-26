/**
 * The banner every unreviewed legal page carries.
 *
 * THE OWNER ASKED FOR DEMO IDENTITY VALUES "for now" so the three dead
 * footer links would stop 404ing before a solicitor has read anything.
 * That is a reasonable thing to want on a shop still in Stripe test mode,
 * and it is also the single easiest way to end up publishing a fabricated
 * company number — the page works, it looks finished, and nobody
 * remembers it was scaffolding.
 *
 * So the demo values are never silent. Every page that carries one opens
 * with this, in the Attention tone, stating plainly that the document is
 * not in force and the registration details are placeholders. It is not
 * decorative: `--mc-accent` is a FILL with `--mc-accent-text` on it (rule
 * 8), the word "DRAFT" carries the meaning rather than the colour, and it
 * is the first thing in the reading order rather than a footnote.
 *
 * REMOVING IT IS THE LAST STEP OF GOING LIVE, after the real identity
 * facts are in and a solicitor has signed the text off. If you are
 * reading this because you are about to delete the component, check that
 * both of those have actually happened.
 */
export function DraftNotice({ what }: { what: string }) {
  return (
    <aside
      role="note"
      aria-label="Draft document notice"
      style={{
        background: 'var(--mc-accent)',
        color: 'var(--mc-accent-text)',
        border: '1px solid var(--mc-border-strong)',
        borderRadius: 'var(--mc-radius-sm)',
        padding: '16px 18px',
        marginBottom: 28,
      }}
    >
      <p
        style={{
          margin: '0 0 6px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '1.4px',
          textTransform: 'uppercase',
        }}
      >
        Draft — not in force
      </p>
      <p style={{ margin: 0, fontSize: 15, lineHeight: '23px' }}>
        {what} It has not been reviewed by a solicitor, and the company registration details below
        are placeholders rather than real ones. Do not rely on it. If you need to know where you
        stand on an order you have already placed, write to us and we will tell you.
      </p>
    </aside>
  );
}

/**
 * The placeholder identity block. ONE definition, used by all three
 * pages, so that replacing it with the real thing is a single edit and
 * cannot be done to two pages out of three.
 *
 * Every value here is deliberately and visibly not real. A plausible-
 * looking fake company number is worse than an obvious one: somebody
 * might believe it.
 */
export const DEMO_IDENTITY = {
  legalName: 'Metheues Clothings Ltd (placeholder — not a registered entity)',
  address: 'Registered address not yet set — placeholder',
  companyNumber: '00000000 (placeholder)',
  vatNumber: 'Not yet registered (placeholder)',
  jurisdiction: 'England and Wales (placeholder — set this to the jurisdiction of your registered office)',
} as const;

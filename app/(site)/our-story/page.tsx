import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { ContentPage, ContentSection, ContentText } from '@/components/site/content-page';

export const metadata = {
  title: 'Our Story — Metheues Clothings',
  description: 'Where Metheues Clothings started, what we make, and how it is made.',
};

/**
 * 32 Our Story — Figma 122:6087 Desktop pulled, 122:5948 Tablet and
 * 122:5815 Mobile measured through get_metadata rather than eyeballed from
 * a screenshot. Built on the ledger's content_page_shell, the same column
 * 33 Delivery and Returns uses.
 *
 * This closes the header's "Our Story", which has 404'd on every page of
 * the site since the chrome was built and is a quarter of the primary
 * navigation.
 *
 * THE PAGE IS OWNER COPY AND IS KEPT AS WRITTEN, which is a different call
 * from the one the homepage and /delivery made. Those pages narrow claims
 * the SYSTEM cannot keep — a carrier nothing configures, a collection fee
 * nothing charges. The origin story is not a system claim; it is the one
 * page whose entire content is the owner speaking for the business, and
 * rewriting it from here would be inventing a different company.
 *
 * ONE CLAIM IS DIFFERENT, and it is the only thing on this page the shop
 * itself can contradict: "three fits — regular, relaxed and oversized".
 * `products.fit` is a real column and the shop listing builds its Fit
 * filter out of whatever is actually in it, so a hardcoded three would sit
 * one click away from a filter offering something else. The sentence reads
 * the same column the filter does, so the two cannot disagree; when no
 * product has a fit set — which is the live state today — the clause drops
 * out rather than naming fits nobody has recorded.
 *
 * NOT narrowed, deliberately: "Printing and finishing happen in the UK"
 * and the "Made in the UK" card. `products.made_in` is a per-garment fact
 * about the blank, and the design's own wording is careful to separate the
 * two — a blank woven elsewhere and printed here is both. Worth raising
 * with the design owner all the same: a customer reading this page and
 * then a product's Made in row will take them for the same claim.
 *
 * The story image is the same well every unphotographed surface shows. A05
 * can upload a product photograph and A21 the homepage hero, but there is
 * no slot for an editorial image here — §9.7 is explicit that the content
 * system is seven homepage slots and not a page builder, so an eighth key
 * in `homepage_sections` read by a page that is not the homepage, editable
 * on a screen that does not draw it, would be worse than the well.
 */
export default async function OurStoryPage() {
  const supabase = await createServerComponentClient();

  // Same query shape the shop listing's Fit filter is built from, so the
  // two readings of this column can never drift apart.
  const { data: products, error } = await supabase
    .from('products')
    .select('fit')
    .eq('status', 'published');
  if (error) throw new Error(`Could not load products: ${error.message}`);

  const fits = [...new Set((products ?? []).map((p) => p.fit).filter((f): f is string => !!f))].sort();

  return (
    <ContentPage
      breadcrumb="Our Story"
      title="Our Story"
      intro="Metheues Clothings started with one idea: that a T-shirt is the most-worn thing most people own, and almost nobody makes them like it matters."
    >
      <div className="mc-story-image">
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '1.2px',
            color: 'var(--mc-text-muted)',
          }}
        >
          STUDIO PHOTOGRAPHY 16:9
        </span>
      </div>

      <ContentSection heading="Where it started">
        <ContentText>
          The label began in a bedroom in Manchester, between a laptop, a borrowed heat press and a
          stack of blanks that were never quite right. The prints were fine. The T-shirts underneath
          them were not — thin, short-lived, cut for nobody in particular.
        </ContentText>
        <ContentText>
          So we started at the other end. Find the garment first. Make the graphic worth putting on
          it second.
        </ContentText>
      </ContentSection>

      <ContentSection heading="What we make">
        <ContentText>
          Heavyweight cotton T-shirts{fitClause(fits)} carrying original artwork shaped by music
          and the culture around it. Every drop is a fixed run. When a size is gone, it is gone; we
          would rather disappoint you once than sell the same shirt for three years.
        </ContentText>
      </ContentSection>

      <ContentSection heading="How it is made">
        <ContentText>
          Blanks are chosen for weight and how they hold a shape after washing, not for what they
          cost. Printing and finishing happen in the UK, close enough that we can stand in the room
          when a run goes wrong. Nothing ships that we would not wear ourselves.
        </ContentText>
      </ContentSection>

      {/* 122:6160 — the §8.1 launch line on the inverse ground. Accent is a
          GROUND and never type on a pale surface, which is why this block is
          ink rather than acid; the supporting line uses the muted inverse
          token for the same reason the footer does. */}
      <div className="mc-story-quote">
        <p className="mc-story-quote-title">“Wear the vibe.”</p>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: '23px',
            color: 'var(--mc-text-muted-inverse)',
          }}
        >
          Premium T-shirts shaped by music, identity and original expression.
        </p>
      </div>

      <div className="mc-story-values">
        {VALUES.map((value) => (
          <div key={value.title} className="mc-story-value">
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{value.title}</p>
            <p style={{ margin: 0, fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)' }}>
              {value.body}
            </p>
          </div>
        ))}
      </div>

      {/* 122:6173. Both buttons hug at every breakpoint (200 and 256 in the
          frames) and wrap on a phone rather than going full width. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 12px' }}>
        {/* "The First Drop" is the homepage hero's own default destination
            too: `collections` has no rows, so there is no drop page to send
            anyone to and the header's New Drop makes the same call. */}
        <Link href="/shop" className="mc-button-primary">
          Shop the First Drop
        </Link>
        <Link href="/delivery" className="mc-button-ghost">
          Read Delivery and Returns
        </Link>
      </div>
    </ContentPage>
  );
}

const VALUES = [
  {
    title: 'Made in the UK',
    body: 'Printed and finished here, so we can see the run and fix it when it is wrong.',
  },
  {
    title: 'Limited runs',
    body: 'A drop is made once. No quiet restocks of whatever sold.',
  },
  {
    title: 'No dark patterns',
    body: 'No countdown timers, no fake stock counts, no pre-ticked boxes at checkout.',
  },
];

const NUMBER_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six'];

/**
 * The design writes "in three fits — regular, relaxed and oversized". That
 * is three separate facts about `products.fit`, all of which the catalogue
 * can disprove, so all three are read from it: how many, which, and whether
 * to make the claim at all.
 */
function fitClause(fits: string[]): string {
  if (fits.length === 0) return ' ';
  const count = NUMBER_WORDS[fits.length] ?? String(fits.length);
  if (fits.length === 1) return ` in one fit — ${fits[0]} — `;
  const list = `${fits.slice(0, -1).join(', ')} and ${fits[fits.length - 1]}`;
  return ` in ${count} fits — ${list} — `;
}

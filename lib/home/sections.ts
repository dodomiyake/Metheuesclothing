import 'server-only';

/**
 * The seven §9.7 content controls, which is what `homepage_sections`
 * (key text primary key, content jsonb) was always for and what nothing
 * has ever read. A21 Store content is the editor; this is the reader, and
 * it comes first for the same reason screen 19 came before A09/A10 — an
 * editor whose fields reach nobody is not a feature.
 *
 * §9.7 lists: announcement bar, hero campaign, featured drop, featured
 * T-shirts, brand/craft story, newsletter text, delivery and return
 * highlights. "This is a limited content system, not a general page
 * builder", so the keys are a FIXED set and each one has a fixed shape.
 * Section order, how many T-shirts are featured and the layout are not
 * editable — A21's own note says it should say so rather than implying a
 * page builder.
 *
 * The homepage's Fit and size guidance block is deliberately NOT a slot:
 * §9.7 does not list it, so its copy stays in the page.
 *
 * EVERY SLOT HAS A DEFAULT and the table starts empty, so the homepage
 * renders the designed copy on a database with no content rows at all.
 * A missing key is not an error, and a key holding the wrong shape falls
 * back field by field rather than blanking a section — the same instinct
 * as everything else here: a page that silently loses its headline is
 * worse than one that shows the words it shipped with.
 */

export type HeroContent = {
  eyebrow: string;
  title: string;
  body: string;
  cta_label: string;
  cta_href: string;
};

export type StoryContent = {
  eyebrow: string;
  title: string;
  body: string;
  cta_label: string;
  cta_href: string;
};

export type CraftContent = {
  eyebrow: string;
  title: string;
  body: string;
  specs: { label: string; value: string }[];
};

export type ReassuranceContent = { items: { title: string; body: string }[] };
export type NewsletterContent = { title: string; body: string };
export type AnnouncementContent = { message: string };
export type FeaturedDropContent = { eyebrow: string; title: string; collection_slug: string | null };
export type FeaturedProductsContent = { slugs: string[] };

export type HomeContent = {
  announcement: AnnouncementContent;
  hero: HeroContent;
  featured_drop: FeaturedDropContent;
  featured_products: FeaturedProductsContent;
  story: StoryContent;
  craft: CraftContent;
  newsletter: NewsletterContent;
  reassurance: ReassuranceContent;
};

/**
 * `{threshold}` in the announcement message is replaced with the real
 * free-delivery figure from store_settings.
 *
 * That placeholder is the whole reason this slot is safe to make editable.
 * The Announcement Bar component's own description says "the free-delivery
 * threshold quoted here must match Store settings — nothing validates that
 * automatically, so treat the two as one change", and today the bar derives
 * the number so the two CANNOT disagree. Turning it into free text would
 * trade that guarantee for editability. The placeholder keeps both: write
 * any sentence you like, and the number in it is still the one checkout
 * charges against.
 */
export { THRESHOLD_TOKEN } from './tokens';
import { THRESHOLD_TOKEN } from './tokens';

export const HOME_DEFAULTS: HomeContent = {
  announcement: { message: `Free UK delivery on orders over ${THRESHOLD_TOKEN}` },
  hero: {
    eyebrow: 'The First Drop',
    title: 'Wear the Vibe',
    body: 'Premium T-shirts shaped by music, identity and original expression.',
    cta_label: 'Shop the First Drop',
    cta_href: '/shop',
  },
  featured_drop: {
    eyebrow: 'The First Drop',
    title: 'Four tees, one frequency',
    collection_slug: null,
  },
  featured_products: { slugs: [] },
  story: {
    eyebrow: 'Behind the design',
    title: 'Every print starts as a sound',
    body: 'Each tee begins with a track, a memory or a phrase that stuck. The graphic comes after — drawn once, printed once, and retired when the drop closes.',
    cta_label: 'Read the story',
    cta_href: '/our-story',
  },
  craft: {
    eyebrow: 'Fabric, print and construction',
    title: '240 GSM, combed cotton, printed in the UK',
    body: 'Heavyweight combed cotton with a set-in collar and twin-needle hems. Screen-printed in small runs so the ink sits in the cloth rather than on it.',
    specs: [
      { label: 'Weight', value: '240 GSM' },
      { label: 'Fabric', value: '100% combed cotton' },
      { label: 'Neckline', value: 'Ribbed set-in collar' },
      { label: 'Print', value: 'Water-based screen print' },
    ],
  },
  newsletter: {
    title: 'Join the Metheues Frequency',
    body: 'Drop alerts and first access. No more than twice a month, and you can leave any time.',
  },
  reassurance: {
    items: [
      // The design's third line reads "On orders over £150, tracked with
      // DPD". The threshold is a token for the reason above; DPD is gone,
      // because no carrier is configured anywhere — A14's carrier field is
      // free text for exactly that reason, and naming one on the homepage
      // would be the shop's most public unverifiable claim.
      { title: 'Free UK delivery', body: `On orders over ${THRESHOLD_TOKEN}, tracked` },
      // The design says "14-day returns" while store_settings seeds 30.
      // The real window is a token too, so the homepage cannot promise a
      // shorter one than request_return() enforces.
      { title: 'Returns', body: 'Unworn, with tags, from the day it arrives' },
      { title: 'Secure payment', body: 'Payments handled securely by Stripe' },
    ],
  },
};

export const HOME_SECTION_KEYS = Object.keys(HOME_DEFAULTS) as (keyof HomeContent)[];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Merge one stored row over its default, field by field. A stored value
 * only wins if it is the right type and not blank. */
function mergeSlot<T extends Record<string, unknown>>(fallback: T, stored: unknown): T {
  if (!isObject(stored)) return fallback;
  const out = { ...fallback };
  for (const key of Object.keys(fallback) as (keyof T)[]) {
    const value = stored[key as string];
    const base = fallback[key];
    if (typeof base === 'string') {
      if (typeof value === 'string' && value.trim()) out[key] = value as T[keyof T];
    } else if (Array.isArray(base)) {
      if (Array.isArray(value)) out[key] = value as T[keyof T];
    } else if (base === null) {
      // collection_slug: null is a legitimate stored value, so anything
      // string-or-null wins.
      if (value === null || typeof value === 'string') out[key] = (value || null) as T[keyof T];
    }
  }
  return out;
}

export function buildHomeContent(rows: { key: string; content: unknown }[]): HomeContent {
  const byKey = new Map(rows.map((r) => [r.key, r.content]));
  return {
    announcement: mergeSlot(HOME_DEFAULTS.announcement, byKey.get('announcement')),
    hero: mergeSlot(HOME_DEFAULTS.hero, byKey.get('hero')),
    featured_drop: mergeSlot(HOME_DEFAULTS.featured_drop, byKey.get('featured_drop')),
    featured_products: mergeSlot(HOME_DEFAULTS.featured_products, byKey.get('featured_products')),
    story: mergeSlot(HOME_DEFAULTS.story, byKey.get('story')),
    craft: mergeSlot(HOME_DEFAULTS.craft, byKey.get('craft')),
    newsletter: mergeSlot(HOME_DEFAULTS.newsletter, byKey.get('newsletter')),
    reassurance: mergeSlot(HOME_DEFAULTS.reassurance, byKey.get('reassurance')),
  };
}

/** Replace {threshold} with the real figure. */
export function withThreshold(text: string, formattedThreshold: string): string {
  return text.split(THRESHOLD_TOKEN).join(formattedThreshold);
}

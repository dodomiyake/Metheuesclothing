import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { ProductCard, type ProductCardData } from './shop/product-card';
import { summarizeProduct } from '@/lib/shop/product-summary';
import { loadPrimaryImages } from '@/lib/shop/product-images';
import { imageUrl } from '@/lib/images';
import { formatPence } from '@/lib/money';
import { buildHomeContent, withThreshold } from '@/lib/home/sections';

/**
 * 02 Homepage — Figma 38:190 (Desktop pulled), 36:93 (Tablet) and 28:2
 * (Mobile) checked by screenshot.
 *
 * THIS REPLACES A FOURTEEN-LINE PLACEHOLDER that said the storefront was
 * under construction, which it has not been for some time: the shop, the
 * product page, the bag, collections, auth and order tracking are all
 * built, and the front door still apologised for them.
 *
 * It is also what unblocks A21 Store content. `homepage_sections` has
 * existed since migration 001 and NOTHING has ever read it, so an editor
 * for it would have been a form writing to a table no page consults —
 * exactly the trap Collections nearly fell into. lib/home/sections.ts
 * holds the seven §9.7 slots with a default for each, so this page renders
 * the designed copy against an empty table and A21 only ever overrides.
 *
 * SECTION ORDER IS FIXED, which §9.7 is explicit about: "a limited content
 * system, not a general page builder." The order here is the order in
 * 02A, and nothing in the admin will move it.
 *
 * THE FEATURED T-SHIRTS ARE REAL PRODUCTS. The design shows four cards
 * with New / Limited Edition / Low stock labels, and every one of those is
 * derived the same way the shop listing derives them — published_at,
 * collection membership, stock_quantity against low_stock_threshold. When
 * the featured_products slot names slugs, those are used in that order;
 * when it is empty (which it is today) the four most recently published
 * T-shirts stand in, so the section is never blank while a drop is being
 * curated.
 *
 * TWO DEPARTURES FROM THE DESIGN'S COPY, both narrowing a claim:
 *
 *  - "On orders over £150, tracked with DPD" loses DPD. No carrier is
 *    configured anywhere — A14's carrier field is free text for that exact
 *    reason — and naming one on the homepage would be this shop's most
 *    public unverifiable promise. The threshold itself is a {threshold}
 *    token resolved from store_settings, so it cannot drift from what
 *    checkout charges.
 *  - "14-day returns" becomes "Returns". The design's number and the
 *    seeded store_settings value (30) disagree, and the homepage is the
 *    wrong place to settle it: whatever request_return() enforces is the
 *    real window, and it is stated on the product page and in the return
 *    flow where someone is actually deciding.
 *
 * The hero reads the `hero` slot's own image_path (A21) and every card its
 * position-0 product_images row (A05). Where nothing has been uploaded yet
 * both keep the same honest wells the rest of the storefront uses.
 */
export default async function HomePage() {
  const supabase = await createServerComponentClient();

  const [sectionsQuery, settingsQuery] = await Promise.all([
    supabase.from('homepage_sections').select('key, content'),
    supabase.from('store_settings').select('free_delivery_threshold_pence').single(),
  ]);

  // A query error and an empty content table both leave `data` null, and
  // only the second is "nothing published yet" (CLAUDE.md's swallowed-error
  // note). Here the second is the NORMAL case — the table is empty and the
  // defaults carry the page — so an error must not quietly look like it.
  if (sectionsQuery.error) {
    throw new Error(`Could not load the homepage content: ${sectionsQuery.error.message}`);
  }
  const content = buildHomeContent(
    (sectionsQuery.data ?? []) as { key: string; content: unknown }[],
  );

  // Same reasoning as the layout's announcement bar: a wrong threshold is
  // worse than a missing page, but not worse than no homepage at all, so
  // this one line falls back rather than throwing.
  const thresholdText = formatPence(
    settingsQuery.error || !settingsQuery.data
      ? 15000
      : (settingsQuery.data.free_delivery_threshold_pence as number),
  );

  const featured = await loadFeatured(supabase, content.featured_products.slugs);
  const heroImage = imageUrl(content.hero.image_path);

  return (
    <main style={{ fontFamily: 'var(--mc-font-body)' }}>
      {/* Hero — 38:215. Split at 768 and above, stacked below. */}
      <section className="mc-home-hero">
        {heroImage ? (
          // A21 holds this path and its alt text. An empty alt is a real
          // choice, not a missing one: the hero's words sit beside the
          // picture in text, so an undescribed campaign shot is treated as
          // decoration rather than given a guess at what it shows.
          <div className="mc-home-hero-image mc-home-hero-image-filled">
            <img src={heroImage} alt={content.hero.image_alt} />
          </div>
        ) : (
          <div className="mc-home-hero-image" aria-hidden>
            <span className="mc-home-well-label">CAMPAIGN PHOTOGRAPHY 4:5</span>
          </div>
        )}
        <div className="mc-home-hero-copy">
          {/* The featured drop's eyebrow, not a hero field — see
              lib/home/sections.ts. Both frames say the same words. */}
          <p className="mc-home-eyebrow">{content.featured_drop.eyebrow}</p>
          <h1 className="mc-home-hero-title">{content.hero.title}</h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--mc-text-muted)', margin: 0 }}>
            {content.hero.body}
          </p>
          <Link href={content.hero.cta_href} className="mc-button-primary">
            {content.hero.cta_label}
          </Link>
        </div>
      </section>

      {/* Latest drop — 38:224. */}
      <section className="mc-page-gutter mc-home-section">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p className="mc-home-eyebrow">{content.featured_drop.eyebrow}</p>
          <h2 className="mc-home-section-title">{content.featured_drop.title}</h2>
        </div>
        {featured.length === 0 ? (
          <p style={{ color: 'var(--mc-text-muted)', margin: 0 }}>
            Nothing published yet.{' '}
            <Link href="/shop" style={{ color: 'var(--mc-text-primary)' }}>
              The shop
            </Link>{' '}
            will fill as T-shirts go live.
          </p>
        ) : (
          <div className="mc-home-drop-grid">
            {featured.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
        {content.featured_drop.collection_slug && (
          <Link
            href={`/collections/${content.featured_drop.collection_slug}`}
            className="mc-button-ghost"
            style={{ alignSelf: 'flex-start' }}
          >
            See the whole drop
          </Link>
        )}
      </section>

      {/* Story — 39:255. */}
      <section className="mc-page-gutter mc-home-section">
        <p className="mc-home-eyebrow">{content.story.eyebrow}</p>
        <h2 className="mc-home-section-title" style={{ maxWidth: 760 }}>
          {content.story.title}
        </h2>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--mc-text-muted)', maxWidth: 640, margin: 0 }}>
          {content.story.body}
        </p>
        {/* The design's "Read the story" goes to screen 32 Our Story.
            It was omitted here while that screen was unbuilt — the
            header's own /our-story link 404'd and a second dead end from
            the homepage would have compounded it. 32 exists now, so the
            link the design draws is back. */}
        {/* A real Ghost Button instance at the section's own gutter (39:259),
            so its label sits 24px in from the copy above — the same
            treatment the hero's Primary button gets. */}
        <Link href="/our-story" className="mc-button-ghost" style={{ alignSelf: 'flex-start' }}>
          Read the story
        </Link>
      </section>

      {/* Fabric and construction — 39:262. The one dark band on the page.
          Supporting text uses --mc-text-muted-inverse: the pale Slate fails
          AA on ink (rule 8). */}
      <section className="mc-home-craft">
        <div className="mc-page-gutter mc-home-craft-inner">
          <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p className="mc-home-eyebrow" style={{ color: 'var(--mc-text-muted-inverse)' }}>
              {content.craft.eyebrow}
            </p>
            <h2
              className="mc-home-section-title"
              style={{ color: 'var(--mc-text-inverse)', fontSize: 'var(--mc-type-craft-title)' }}
            >
              {content.craft.title}
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--mc-text-muted-inverse)', margin: 0 }}>
              {content.craft.body}
            </p>
          </div>
          <dl style={{ flex: '1 0 0', minWidth: 0, margin: 0 }}>
            {content.craft.specs.map((spec) => (
              <div
                key={spec.label}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '16px 0',
                  borderBottom: '1px solid var(--mc-text-muted-inverse)',
                }}
              >
                <dt style={{ flex: '1 0 0', minWidth: 0, fontSize: 15, color: 'var(--mc-text-muted-inverse)' }}>
                  {spec.label}
                </dt>
                <dd style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--mc-text-inverse)' }}>
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Fit and size guidance — 39:281. NOT a content slot: §9.7 does not
          list it, so this copy lives in the page. */}
      <section className="mc-page-gutter mc-home-section">
        <p className="mc-home-eyebrow">Find your fit</p>
        <h2 className="mc-home-section-title" style={{ maxWidth: 760 }}>
          Regular, relaxed or oversized
        </h2>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--mc-text-muted)', maxWidth: 640, margin: 0 }}>
          Every tee lists chest width, body length, shoulder and sleeve in centimetres and inches,
          measured flat on the garment — not on a body.
        </p>
        {/* The design's "Open the size guide" is a Secondary button to screen
            23, which is not built. It is a link to the shop instead of a
            dead control; the measurements themselves are on each product
            page, and are owner-blocked anyway (§8.5 — the size tables in
            the design are placeholders and must not ship). */}
        <Link href="/shop" className="mc-button-secondary" style={{ alignSelf: 'flex-start' }}>
          Browse the T-shirts
        </Link>
      </section>

      {/* Delivery and returns reassurance — 39:288. */}
      <section className="mc-home-reassurance">
        <div className="mc-page-gutter mc-home-reassurance-inner">
          {content.reassurance.items.map((item) => (
            <div key={item.title} style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p className="mc-home-eyebrow" style={{ color: 'var(--mc-text-primary)' }}>
                {item.title}
              </p>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--mc-text-muted)', margin: 0 }}>
                {withThreshold(item.body, thresholdText)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

type SupabaseClient = Awaited<ReturnType<typeof createServerComponentClient>>;

/**
 * Four T-shirts: the ones the featured_products slot names, in that order,
 * or the four most recently published when it is empty. Either way the
 * labels come from real data, exactly as the shop listing computes them.
 */
async function loadFeatured(supabase: SupabaseClient, slugs: string[]): Promise<ProductCardData[]> {
  const base = supabase.from('products').select('id, slug, name, published_at').eq('status', 'published');

  const { data: products, error } = slugs.length
    ? await base.in('slug', slugs.slice(0, 4))
    : await base.order('published_at', { ascending: false }).limit(4);
  if (error) throw new Error(`Could not load the featured T-shirts: ${error.message}`);

  const rows = (products ?? []) as { id: string; slug: string; name: string; published_at: string | null }[];
  if (!rows.length) return [];

  const ids = rows.map((p) => p.id);
  const [variantsQuery, linksQuery] = await Promise.all([
    supabase
      .from('product_variants')
      .select('product_id, colour, size, price_pence, stock_quantity, low_stock_threshold, is_active')
      .in('product_id', ids)
      .eq('is_active', true),
    supabase.from('product_collections').select('product_id, collections(name)').in('product_id', ids),
  ]);
  if (variantsQuery.error) throw new Error(`Could not load variants: ${variantsQuery.error.message}`);
  if (linksQuery.error) throw new Error(`Could not load collections: ${linksQuery.error.message}`);

  type VariantRow = {
    product_id: string;
    colour: string;
    size: string;
    price_pence: number;
    stock_quantity: number;
    low_stock_threshold: number;
    is_active: boolean;
  };
  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const v of (variantsQuery.data ?? []) as VariantRow[]) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const collectionsByProduct = new Map<string, string[]>();
  for (const link of (linksQuery.data ?? []) as unknown as {
    product_id: string;
    collections: { name: string } | null;
  }[]) {
    if (!link.collections) continue;
    const list = collectionsByProduct.get(link.product_id) ?? [];
    list.push(link.collections.name);
    collectionsByProduct.set(link.product_id, list);
  }

  const primaryImages = await loadPrimaryImages(supabase, ids);

  const cards = rows.map((p) => {
    const image = primaryImages.get(p.id);
    return {
      slug: p.slug,
      name: p.name,
      image: image ? { url: image.url, alt: image.alt } : null,
      ...summarizeProduct(p.published_at, variantsByProduct.get(p.id) ?? [], collectionsByProduct.get(p.id) ?? []),
    };
  });

  // `.in()` does not preserve the order the slugs were given in, and the
  // order IS the curation when a drop has been chosen.
  if (!slugs.length) return cards;
  const rank = new Map(slugs.map((s, i) => [s, i]));
  return cards.sort((a, b) => (rank.get(a.slug) ?? 99) - (rank.get(b.slug) ?? 99));
}

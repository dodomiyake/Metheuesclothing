import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { FilterGroups } from '../../shop/filter-groups';
import { DiscoveryBar } from '../../shop/discovery-bar';
import { SortSelect } from '../../shop/sort-select';
import { ProductCard, type ProductCardData } from '../../shop/product-card';
import { summarizeProduct } from '@/lib/shop/product-summary';
import { sortSizes } from '@/lib/shop/size-order';
import {
  activeFilterCount,
  clearAllHref,
  clearHref,
  getSelected,
  type ShopSearchParams,
} from '@/lib/shop/filters';

/**
 * Screen 19 — the collection page (Figma 121:5606 Desktop pulled;
 * 121:5514 Tablet and 121:5428 Mobile checked by screenshot).
 *
 * THIS IS THE PAGE THE WHOLE COLLECTIONS FEATURE WAS MISSING. `collections`
 * has existed since migration 001 with a slug, a description, a hero, a
 * position and SEO columns, and until now nothing read any of them: the
 * header's "Collections" link pointed at /collections, which 404'd, and the
 * table was used only as a filter facet and a label on a product card. A09
 * and A10 (the admin list and editor) describe a storefront built on this
 * page — their handle helper says metheues.com/collections/<handle>, which
 * is exactly this route — so this had to exist before an editor for it
 * could claim to do anything.
 *
 * It is 03 Product Listing with three things added and one removed, which is
 * what the ledger says it is. Rather than copy that page, the rail, sheet
 * and sort control are the SAME components, now taking a basePath — two
 * copies of filter machinery drift the first time either changes.
 *
 * Added: the 16:9 hero band, the breadcrumb, and the drop metadata row.
 * Removed: the Collection facet, because the page IS the collection. It
 * disappears by passing an empty option list, not by a special case.
 *
 * TWO OF THE DESIGN'S FOUR METADATA FIELDS ARE REAL AND TWO ARE NOT.
 * RELEASED is collections.published_at. STYLES is a count of what is
 * actually in the collection and published. RUN — "Limited — not
 * restocked" — has no backing column anywhere, and a shop promising never
 * to restock something is the one claim a customer can disprove by coming
 * back in a month, so it is omitted. MADE — "Printed and finished in the
 * UK" — IS real, as products.made_in, but it is per product rather than
 * per collection, so it appears only when every product in the collection
 * agrees; a collection whose items were made in two places would otherwise
 * claim one of them for all of them.
 *
 * THE DESIGN AND THE DATABASE DISAGREE ABOUT HIDDEN COLLECTIONS, and the
 * database wins here. A09's footer says "hiding a collection takes it out
 * of the menu but its page stays reachable by its address, so links you
 * have already shared keep working". The RLS policy is
 * `status = 'live' or is_staff()` (002_rls.sql:88), so a hidden collection
 * returns no row to a customer at all and this page 404s. Both behaviours
 * are defensible — one keeps shared links alive, the other makes "hidden"
 * mean hidden — but they cannot both be true, and changing a security
 * policy to match a sentence in a footer is the wrong way round. Settle it
 * with the design owner; A09 gets the narrower wording until then.
 */
type ProductRow = {
  id: string;
  slug: string;
  name: string;
  fit: string | null;
  made_in: string | null;
  published_at: string | null;
};

type VariantRow = {
  product_id: string;
  colour: string;
  size: string;
  price_pence: number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
};

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ShopSearchParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const supabase = await createServerComponentClient();
  const basePath = `/collections/${slug}`;

  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .select('id, slug, name, description, hero_alt, status, published_at, seo_title, seo_description')
    .eq('slug', slug)
    .maybeSingle();
  // A query error and a missing row both leave `data` null, and only the
  // second is a 404 (CLAUDE.md's swallowed-error note). notFound() is called
  // only when there is no error AND genuinely no row.
  if (collectionError) throw new Error(`Could not load the collection: ${collectionError.message}`);
  if (!collection) notFound();

  const { data: links, error: linksError } = await supabase
    .from('product_collections')
    .select('product_id, position')
    .eq('collection_id', collection.id)
    .order('position');
  if (linksError) throw new Error(`Could not load this collection: ${linksError.message}`);

  // The order products appear in IS product_collections.position — the thing
  // A10's drag list edits. Held here so the grid can reproduce it after the
  // products query comes back in its own order.
  const order = new Map<string, number>();
  for (const l of links ?? []) order.set(l.product_id as string, (l.position as number) ?? 0);
  const memberIds = [...order.keys()];

  const { data: products, error: productsError } = memberIds.length
    ? await supabase
        .from('products')
        .select('id, slug, name, fit, made_in, published_at')
        .eq('status', 'published')
        .in('id', memberIds)
    : { data: [] as ProductRow[], error: null };
  if (productsError) throw new Error(`Could not load products: ${productsError.message}`);

  const productIds = (products ?? []).map((p) => p.id);

  const { data: variants, error: variantsError } = productIds.length
    ? await supabase
        .from('product_variants')
        .select('product_id, colour, size, price_pence, stock_quantity, low_stock_threshold, is_active')
        .in('product_id', productIds)
        .eq('is_active', true)
    : { data: [] as VariantRow[], error: null };
  if (variantsError) throw new Error(`Could not load variants: ${variantsError.message}`);

  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const v of (variants ?? []) as VariantRow[]) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const allSizes = new Set<string>();
  const allColours = new Set<string>();
  const allFits = new Set<string>();
  const allMadeIn = new Set<string>();
  let priceMin = Infinity;
  let priceMax = 0;

  const cards: (ProductCardData & { id: string; fit: string | null })[] = ((products ?? []) as ProductRow[])
    .map((p) => {
      const vs = variantsByProduct.get(p.id) ?? [];
      for (const v of vs) {
        allSizes.add(v.size);
        allColours.add(v.colour);
        priceMin = Math.min(priceMin, v.price_pence);
        priceMax = Math.max(priceMax, v.price_pence);
      }
      if (p.fit) allFits.add(p.fit);
      if (p.made_in?.trim()) allMadeIn.add(p.made_in.trim());

      // The Limited Edition label is collection-derived, and on this page
      // the collection is a given, so it is passed the same name a product
      // card would see anywhere else rather than an empty list.
      const summary = summarizeProduct(p.published_at, vs, [collection.name as string]);
      return { id: p.id, slug: p.slug, name: p.name, fit: p.fit, ...summary };
    })
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const sizeFilter = getSelected(query, 'size');
  const colourFilter = getSelected(query, 'colour');
  const fitFilter = getSelected(query, 'fit');
  const availabilityFilter = getSelected(query, 'availability');

  let filtered = cards.filter((c) => {
    if (sizeFilter.length) {
      const sizesForProduct = new Set((variantsByProduct.get(c.id) ?? []).map((v) => v.size));
      if (!sizeFilter.some((s) => sizesForProduct.has(s))) return false;
    }
    if (colourFilter.length && !colourFilter.some((col) => c.colours.includes(col))) return false;
    if (fitFilter.length && !(c.fit && fitFilter.includes(c.fit))) return false;
    if (availabilityFilter.includes('In stock only') && !c.inStock) return false;
    return true;
  });

  const sort = Array.isArray(query.sort) ? query.sort[0] : query.sort;
  if (sort === 'price-asc') filtered = [...filtered].sort((a, b) => a.minPrice - b.minPrice);
  else if (sort === 'price-desc') filtered = [...filtered].sort((a, b) => b.minPrice - a.minPrice);
  // Default order is the collection's own, set in A10 — not newest-first,
  // which is what /shop defaults to. A curated drop has an intended order.

  const filterCount = activeFilterCount(query);
  const priceRange: [number, number] | null = priceMin !== Infinity ? [priceMin, priceMax] : null;
  const madeIn = allMadeIn.size === 1 ? [...allMadeIn][0] : null;

  return (
    <main style={{ fontFamily: 'var(--mc-font-body)' }}>
      {/* 121:5706. No collection photography exists (README's blocked-on-owner
          list) and there is no upload pipeline to put any there — A05 is
          omitted for the same reason — so this is the same honest well the
          product cards use rather than a broken <img>.
          Deliberately NOT role="img" with hero_alt as its label: there is no
          image here, and announcing one to a screen reader would describe a
          photograph nobody can see. hero_alt is selected above and goes on
          the <img> the day one exists. */}
      <div className="mc-collection-hero">
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '1.2px',
            color: 'var(--mc-text-muted)',
          }}
        >
          COLLECTION PHOTOGRAPHY 16:9
        </span>
      </div>

      <div
        className="mc-page-gutter"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          paddingTop: 'var(--mc-space-xl)',
          paddingBottom: 'var(--mc-space-lg)',
        }}
      >
        <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
          <Link href="/" style={{ color: 'inherit' }}>
            Home
          </Link>{' '}
          /{' '}
          <Link href="/collections" style={{ color: 'inherit' }}>
            Collections
          </Link>{' '}
          / {collection.name}
        </p>
        <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)', margin: 0 }}>
          {collection.name}
        </h1>
        {collection.description && (
          <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--mc-text-muted)', maxWidth: 620, margin: 0 }}>
            {collection.description}
          </p>
        )}
      </div>

      {/* 121:5708. Only the fields that read a real column — see the note at
          the top of this file for why RUN is not here. */}
      <div
        className="mc-page-gutter"
        style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px', paddingBottom: 'var(--mc-space-md)' }}
      >
        {collection.published_at && (
          <Meta label="Released" value={formatReleased(collection.published_at as string)} />
        )}
        <Meta label="Styles" value={String(cards.length)} />
        {madeIn && <Meta label="Made" value={madeIn} />}
      </div>

      <DiscoveryBar
        params={query}
        resultCount={filtered.length}
        filterCount={filterCount}
        availableSizes={sortSizes(allSizes)}
        availableColours={[...allColours]}
        availableFits={[...allFits]}
        availableCollections={[]}
        priceRange={priceRange}
        basePath={basePath}
      />

      <div className="mc-page-gutter mc-shop-layout" style={{ paddingTop: 8, paddingBottom: 80 }}>
        <aside className="mc-filter-rail" style={{ flexDirection: 'column', width: 240, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 16 }}>
            <p style={{ flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: '1.54px', textTransform: 'uppercase', margin: 0 }}>
              Filter
            </p>
            {filterCount > 0 && (
              <Link href={clearAllHref(basePath)} style={{ color: 'var(--mc-text-muted)', fontSize: 13 }}>
                Clear all
              </Link>
            )}
          </div>
          <FilterGroups
            params={query}
            availableSizes={sortSizes(allSizes)}
            availableColours={[...allColours]}
            availableFits={[...allFits]}
            availableCollections={[]}
            priceRange={priceRange}
            basePath={basePath}
          />
        </aside>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            {(['size', 'colour', 'fit', 'availability'] as const).flatMap((key) =>
              getSelected(query, key).map((value) => (
                <Link
                  key={`${key}-${value}`}
                  href={clearHref(query, key, basePath)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12.5px 10px 12.5px 16px',
                    borderRadius: 'var(--mc-radius-sm)',
                    border: '1px solid var(--mc-border-strong)',
                    background: 'var(--mc-bg-inverse)',
                    color: 'var(--mc-text-inverse)',
                    fontSize: 14,
                    fontWeight: 500,
                    textDecoration: 'none',
                  }}
                >
                  {value}
                  <span aria-hidden>×</span>
                </Link>
              )),
            )}
            {/* THE DESKTOP FRAME CONTRADICTS ITS OWN TABLET FRAME HERE.
                121:5640 draws the results row with the count alone and no
                sort control, while 121:5514 (Tablet) and 121:5428 (Mobile)
                both draw the discovery bar's "Sort · Newest" button, and
                03A keeps sort on desktop. Dropping a control at the WIDEST
                breakpoint only, where there is the most room for it, is a
                regression no rationale supports — so sort stays. Worth
                settling with the design owner alongside "To pack" and the
                E7 naming. */}
            <div className="mc-desktop-sort" style={{ marginLeft: 'auto', alignItems: 'center', gap: 12 }}>
              <SortSelect basePath={basePath} />
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--mc-text-muted)', margin: 0, whiteSpace: 'nowrap' }}>
                {filtered.length} style{filtered.length === 1 ? '' : 's'} in this drop
              </p>
            </div>
          </div>

          {!filtered.length ? (
            <p style={{ color: 'var(--mc-text-muted)' }}>
              {cards.length
                ? 'No T-shirts in this collection match these filters.'
                : 'Nothing in this collection yet — check back soon.'}
            </p>
          ) : (
            <div className="mc-product-grid-shop">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/** 121:5709 — a 10px SemiBold label over a 14px Medium value. */
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          color: 'var(--mc-text-muted)',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

/** "5 September 2026" (121:5711). */
function formatReleased(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerComponentClient();
  const { data } = await supabase
    .from('collections')
    .select('name, description, seo_title, seo_description')
    .eq('slug', slug)
    .maybeSingle();
  if (!data) return {};
  // seo_title/seo_description are the columns A10 edits. Until now nothing
  // read them, which is the whole reason that editor had nothing behind it.
  return {
    title: data.seo_title || `${data.name} — Metheues Clothings`,
    description: data.seo_description || data.description || undefined,
  };
}

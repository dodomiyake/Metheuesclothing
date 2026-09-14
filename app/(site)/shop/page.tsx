import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { FilterGroups } from './filter-groups';
import { DiscoveryBar } from './discovery-bar';
import { SortSelect } from './sort-select';
import { ProductCard, type ProductCardData } from './product-card';
import { summarizeProduct } from '@/lib/shop/product-summary';
import {
  activeFilterCount,
  clearAllHref,
  clearHref,
  getSelected,
  type ShopSearchParams,
} from '@/lib/shop/filters';

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  fit: string | null;
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

/**
 * §8.2 product listing (03A/B/C — Figma node 51:531/50:406/47:287), rebuilt
 * against the real screens rather than the earlier token-styled MVP subset.
 * Filters are real, not decorative: Size/Colour/Fit read product_variants
 * and products.fit directly; Collection reads product_collections (empty
 * today, so that group renders nothing rather than fake options); "Design
 * style" (Graphic/Essential/Limited in the design) has no backing column
 * anywhere in the schema and is omitted rather than faked. New/Limited
 * Edition/Low stock/Sold out labels are derived from published_at,
 * collection membership and stock_quantity vs low_stock_threshold — never
 * hardcoded. No product photography exists yet, so every card keeps the
 * "Product photography 4:5" placeholder well.
 */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createServerComponentClient();

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, slug, name, fit, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false });
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

  type CollectionLinkRow = { product_id: string; collections: { slug: string; name: string } | null };
  const { data: collectionLinksRaw, error: collectionsError } = productIds.length
    ? await supabase
        .from('product_collections')
        .select('product_id, collections(slug, name)')
        .in('product_id', productIds)
    : { data: [] as CollectionLinkRow[], error: null };
  if (collectionsError) throw new Error(`Could not load collections: ${collectionsError.message}`);
  const collectionLinks = (collectionLinksRaw ?? []) as unknown as CollectionLinkRow[];

  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const v of (variants ?? []) as VariantRow[]) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const collectionsByProduct = new Map<string, string[]>();
  const allCollectionNames = new Set<string>();
  for (const link of collectionLinks ?? []) {
    if (!link.collections) continue;
    const list = collectionsByProduct.get(link.product_id) ?? [];
    list.push(link.collections.name);
    collectionsByProduct.set(link.product_id, list);
    allCollectionNames.add(link.collections.name);
  }

  const allSizes = new Set<string>();
  const allColours = new Set<string>();
  const allFits = new Set<string>();
  let priceMin = Infinity;
  let priceMax = 0;

  const cards: (ProductCardData & { id: string; fit: string | null; collections: string[] })[] = (products ?? []).map(
    (p: ProductRow) => {
      const vs = variantsByProduct.get(p.id) ?? [];
      for (const v of vs) {
        allSizes.add(v.size);
        allColours.add(v.colour);
        priceMin = Math.min(priceMin, v.price_pence);
        priceMax = Math.max(priceMax, v.price_pence);
      }
      if (p.fit) allFits.add(p.fit);

      const collections = collectionsByProduct.get(p.id) ?? [];
      const summary = summarizeProduct(p.published_at, vs, collections);

      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        fit: p.fit,
        collections,
        ...summary,
      };
    },
  );

  // ---- apply filters (all real data, computed above) ----
  const sizeFilter = getSelected(params, 'size');
  const colourFilter = getSelected(params, 'colour');
  const fitFilter = getSelected(params, 'fit');
  const collectionFilter = getSelected(params, 'collection');
  const availabilityFilter = getSelected(params, 'availability');

  let filtered = cards.filter((c) => {
    if (sizeFilter.length) {
      const sizesForProduct = new Set((variantsByProduct.get(c.id) ?? []).map((v) => v.size));
      if (!sizeFilter.some((s) => sizesForProduct.has(s))) return false;
    }
    if (colourFilter.length && !colourFilter.some((col) => c.colours.includes(col))) return false;
    if (fitFilter.length && !(c.fit && fitFilter.includes(c.fit))) return false;
    if (collectionFilter.length && !collectionFilter.some((col) => c.collections.includes(col))) return false;
    if (availabilityFilter.includes('In stock only') && !c.inStock) return false;
    return true;
  });

  const sort = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  if (sort === 'price-asc') filtered = [...filtered].sort((a, b) => a.minPrice - b.minPrice);
  else if (sort === 'price-desc') filtered = [...filtered].sort((a, b) => b.minPrice - a.minPrice);
  // "Newest" (default) is already the query's own published_at desc order.

  const filterCount = activeFilterCount(params);
  const priceRange: [number, number] | null = priceMin !== Infinity ? [priceMin, priceMax] : null;

  return (
    <main style={{ fontFamily: 'var(--mc-font-body)' }}>
      <div
        className="mc-page-gutter"
        style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 'var(--mc-space-xl)', paddingBottom: 'var(--mc-space-lg)' }}
      >
        <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>Home / T-Shirts</p>
        <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)', margin: 0 }}>All T-Shirts</h1>
        <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--mc-text-muted)', maxWidth: 620, margin: 0 }}>
          Heavyweight essentials, oversized cuts and limited graphic runs.
        </p>
      </div>

      <DiscoveryBar
        params={params}
        resultCount={filtered.length}
        filterCount={filterCount}
        availableSizes={[...allSizes]}
        availableColours={[...allColours]}
        availableFits={[...allFits]}
        availableCollections={[...allCollectionNames]}
        priceRange={priceRange}
      />

      <div className="mc-page-gutter mc-shop-layout" style={{ paddingTop: 8, paddingBottom: 80 }}>
        <aside className="mc-filter-rail" style={{ flexDirection: 'column', width: 240, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 16 }}>
            <p style={{ flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: '1.54px', textTransform: 'uppercase', margin: 0 }}>
              Filter
            </p>
            {filterCount > 0 && (
              <Link href={clearAllHref()} style={{ color: 'var(--mc-text-muted)', fontSize: 13 }}>
                Clear all
              </Link>
            )}
          </div>
          <FilterGroups
            params={params}
            availableSizes={[...allSizes]}
            availableColours={[...allColours]}
            availableFits={[...allFits]}
            availableCollections={[...allCollectionNames]}
            priceRange={priceRange}
          />
        </aside>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            {(['size', 'colour', 'fit', 'collection', 'availability'] as const).flatMap((key) =>
              getSelected(params, key).map((value) => (
                <Link
                  key={`${key}-${value}`}
                  href={clearHref(params, key)}
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
            <div className="mc-desktop-sort" style={{ marginLeft: 'auto', alignItems: 'center', gap: 12 }}>
              <SortSelect />
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--mc-text-muted)', margin: 0, whiteSpace: 'nowrap' }}>
                {filtered.length} style{filtered.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {!filtered.length ? (
            <p style={{ color: 'var(--mc-text-muted)' }}>
              {cards.length ? 'No T-shirts match these filters.' : 'Nothing published yet — check back soon.'}
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

import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { formatPence } from '@/lib/money';

/**
 * §8.2 product listing — MVP subset. Filters, sorting, hover image and the
 * new/limited/low-stock label are deferred; the card itself (name, price,
 * available colours) is not. products_public_read and
 * product_variants_public_read (002_rls.sql) already resolve to "published
 * only" for an anonymous visitor, so this is a plain select.
 */
export default async function ShopPage() {
  const supabase = await createServerComponentClient();

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, slug, name, description_short')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  // Thrown rather than swallowed: `data` comes back null on a query error
  // exactly the same way it does when there are genuinely no rows, and
  // rendering "nothing published yet" for a database that could not be
  // reached is the same mistake as store_settings having no row (CLAUDE.md)
  // -- a real problem that reads as an empty, harmless state. This throw
  // reaches Next's error boundary instead.
  if (productsError) throw new Error(`Could not load products: ${productsError.message}`);

  const productIds = (products ?? []).map((p) => p.id);
  const { data: variants, error: variantsError } = productIds.length
    ? await supabase
        .from('product_variants')
        .select('product_id, colour, price_pence, stock_quantity, is_active')
        .in('product_id', productIds)
        .eq('is_active', true)
    : { data: [] as { product_id: string; colour: string; price_pence: number; stock_quantity: number }[], error: null };
  if (variantsError) throw new Error(`Could not load variants: ${variantsError.message}`);

  const byProduct = new Map<
    string,
    { minPrice: number; colours: Set<string>; inStock: boolean }
  >();
  for (const v of variants ?? []) {
    const entry = byProduct.get(v.product_id) ?? {
      minPrice: v.price_pence,
      colours: new Set<string>(),
      inStock: false,
    };
    entry.minPrice = Math.min(entry.minPrice, v.price_pence);
    entry.colours.add(v.colour);
    entry.inStock = entry.inStock || v.stock_quantity > 0;
    byProduct.set(v.product_id, entry);
  }

  return (
    <main style={{ padding: 'var(--mc-space-xl) var(--mc-gutter-desktop)', fontFamily: 'var(--mc-font-body)' }}>
      <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)' }}>
        Shop
      </h1>

      {!products?.length ? (
        <p style={{ color: 'var(--mc-text-muted)' }}>
          Nothing published yet — check back soon.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 'var(--mc-space-lg)',
          }}
        >
          {products.map((product) => {
            const stats = byProduct.get(product.id);
            return (
              <Link
                key={product.id}
                href={`/shop/${product.slug}`}
                style={{ textDecoration: 'none', color: 'var(--mc-text-primary)' }}
              >
                <div
                  style={{
                    aspectRatio: '4 / 5',
                    background: 'var(--mc-sand)',
                    borderRadius: 'var(--mc-radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--mc-text-muted)',
                    fontSize: 'var(--mc-type-caption)',
                    marginBottom: 'var(--mc-space-xs)',
                  }}
                >
                  No image yet
                </div>
                <div style={{ fontSize: 'var(--mc-type-body)', fontWeight: 600 }}>{product.name}</div>
                <div style={{ fontSize: 'var(--mc-type-body)', color: 'var(--mc-text-muted)' }}>
                  {stats ? formatPence(stats.minPrice) : 'Price unavailable'}
                  {stats && !stats.inStock ? ' · Sold out' : ''}
                </div>
                {stats && stats.colours.size > 0 && (
                  <div style={{ fontSize: 'var(--mc-type-caption)', color: 'var(--mc-text-muted)' }}>
                    {stats.colours.size} colour{stats.colours.size > 1 ? 's' : ''}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

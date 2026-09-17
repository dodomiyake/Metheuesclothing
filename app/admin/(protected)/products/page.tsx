import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';

/**
 * A03 T-shirts table. products_public_read (002_rls.sql) already resolves
 * to "every status" for a staff session, so this is a plain select -- no
 * service role, no extra filter to keep in sync with the RLS policy.
 */
export default async function AdminProductsPage() {
  const supabase = await createServerComponentClient();

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, slug, name, status, updated_at')
    .order('updated_at', { ascending: false });
  // See app/shop/page.tsx's comment -- a query error must not render as an
  // empty catalogue.
  if (productsError) throw new Error(`Could not load products: ${productsError.message}`);

  const productIds = (products ?? []).map((p) => p.id);
  const { data: variants, error: variantsError } = productIds.length
    ? await supabase
        .from('product_variants')
        .select('product_id, stock_quantity, is_active')
        .in('product_id', productIds)
    : { data: [] as { product_id: string; stock_quantity: number; is_active: boolean }[], error: null };
  if (variantsError) throw new Error(`Could not load variants: ${variantsError.message}`);

  const stockByProduct = new Map<string, { total: number; active: number }>();
  for (const v of variants ?? []) {
    const entry = stockByProduct.get(v.product_id) ?? { total: 0, active: 0 };
    entry.total += v.stock_quantity;
    if (v.is_active) entry.active += 1;
    stockByProduct.set(v.product_id, entry);
  }

  return (
    <div style={{ padding: 'var(--mc-space-xl)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--mc-space-lg)',
        }}
      >
        <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)', margin: 0 }}>
          T-shirts
        </h1>
        <Link
          href="/admin/products/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 44,
            padding: '0 var(--mc-space-lg)',
            background: 'var(--mc-action-primary-bg)',
            color: 'var(--mc-action-primary-text)',
            borderRadius: 'var(--mc-radius-sm)',
            textDecoration: 'none',
            fontSize: 'var(--mc-type-body)',
            fontWeight: 600,
          }}
        >
          New product
        </Link>
      </div>

      {!products?.length ? (
        <p style={{ color: 'var(--mc-text-muted)' }}>
          No products yet. &ldquo;New product&rdquo; starts one.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--mc-border-default)', textAlign: 'left' }}>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th>Variants</Th>
              <Th>Stock</Th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const stock = stockByProduct.get(product.id) ?? { total: 0, active: 0 };
              const soldOut = product.status === 'published' && stock.total === 0;
              return (
                <tr key={product.id} style={{ borderBottom: '1px solid var(--mc-border-default)' }}>
                  <Td>
                    <Link
                      href={`/admin/products/${product.id}`}
                      style={{ color: 'var(--mc-text-primary)', fontWeight: 600, textDecoration: 'none' }}
                    >
                      {product.name}
                    </Link>
                    <div style={{ fontSize: 'var(--mc-type-caption)', color: 'var(--mc-text-muted)' }}>
                      {product.slug}
                    </div>
                  </Td>
                  <Td>
                    <StatusBadge status={soldOut ? 'sold_out' : product.status} />
                  </Td>
                  <Td>{stock.active}</Td>
                  <Td>{stock.total}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: 'var(--mc-space-xs) var(--mc-space-sm)',
        fontSize: 'var(--mc-type-label)',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: 'var(--mc-text-muted)',
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: 'var(--mc-space-sm)', fontSize: 'var(--mc-type-body)' }}>{children}</td>;
}

const TONES: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: 'var(--mc-mist)', fg: 'var(--mc-ink)', label: 'Draft' },
  scheduled: { bg: '#DCEBF7', fg: '#1E4F73', label: 'Scheduled' },
  published: { bg: '#E4F1E8', fg: 'var(--mc-teal)', label: 'Published' },
  archived: { bg: 'var(--mc-mist)', fg: 'var(--mc-slate)', label: 'Archived' },
  sold_out: { bg: '#F5E6D8', fg: 'var(--mc-ember)', label: 'Sold out' },
};

// The dot is decorative only -- the word carries the meaning (admin_foundations
// in docs/design-system-state.json), so this still reads correctly in
// greyscale or to a screen reader that skips the presentational span.
function StatusBadge({ status }: { status: string }) {
  const tone = TONES[status] ?? TONES.draft;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        borderRadius: 999,
        background: tone.bg,
        color: tone.fg,
        fontSize: 'var(--mc-type-caption)',
        fontWeight: 600,
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: tone.fg }} />
      {tone.label}
    </span>
  );
}

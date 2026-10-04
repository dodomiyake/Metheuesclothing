import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { StatusBadge, type BadgeTone } from '@/components/admin/status-badge';
import { compareSizes } from '@/lib/shop/size-order';
import { InventoryToolbar } from './inventory-toolbar';

const PAGE_SIZE = 50;

/**
 * A07 Inventory — Figma 128:1220 (Desktop) / 128:1033 (Tablet) / 128:874
 * (Mobile). Like A03 this predated the admin shell and had never been
 * matched to its frames: a bare five-column table at every width, with no
 * top bar, no toolbar and no record list, so a phone squashed it rather
 * than stacking. Now the same shape as A03/A11/A17.
 *
 * Read-only by design. The adjustment form lives on each product's variants
 * page (A08), so there is exactly one caller of adjust_stock rather than two
 * copies of the same form to keep in sync — which is why the design's
 * "Adjust stock" top-bar button is a link into that page's product rather
 * than a global action: there is no such thing as adjusting stock without
 * first choosing a variant.
 *
 * THE FOOTER'S SECOND CLAIM WAS WRONG AND IS NARROWED. Both the design
 * (128:1413) and the version of this page that shipped said "every manual
 * change needs a reason and is written to the audit log". The reason is
 * real — inventory_adjustments.reason is NOT NULL with a non-blank CHECK,
 * and adjust_stock raises without one. The audit log is not: adjust_stock
 * writes to inventory_adjustments and nothing else (010_adjust_stock.sql:64).
 * This is the same overclaim the A01 small print shipped and had corrected,
 * and it is worth not making twice.
 *
 * Omitted: "Export CSV". No route, no format — same call as A11's "Export
 * orders" and A03's "Import CSV".
 */
type VariantRow = {
  id: string;
  colour: string;
  size: string;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  product_id: string;
  products: { name: string } | null;
};

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const q = one('q').trim();
  const show = one('show');
  const product = one('product');
  const sort = one('sort');
  const page = Math.max(1, Number.parseInt(one('page') || '1', 10) || 1);

  const supabase = await createServerComponentClient();

  const { data: productList, error: productsError } = await supabase
    .from('products')
    .select('id, name')
    .order('name');
  if (productsError) throw new Error(`Could not load products: ${productsError.message}`);

  let query = supabase
    .from('product_variants')
    .select(
      'id, colour, size, sku, stock_quantity, low_stock_threshold, is_active, product_id, products(name)',
      { count: 'exact' },
    );

  if (product) query = query.eq('product_id', product);
  if (q) {
    const safe = q.replace(/[%,()]/g, ' ');
    query = query.or(`sku.ilike.%${safe}%,colour.ilike.%${safe}%`);
  }
  // `size` is free text, so ordering by it is alphabetical — the trap
  // lib/shop/size-order.ts exists for. Stock and SKU are safe to order in
  // Postgres; size ordering is applied below.
  query =
    sort === 'sku'
      ? query.order('sku', { ascending: true })
      : sort === 'product'
        ? query.order('product_id', { ascending: true })
        : query.order('stock_quantity', { ascending: true });

  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  // A query error and an empty catalogue both leave `data` null; only the
  // second is "no variants" (CLAUDE.md's swallowed-error note).
  if (error) throw new Error(`Could not load inventory: ${error.message}`);

  let rows = (data ?? []) as unknown as VariantRow[];

  // "Show: needs attention" is stock_quantity <= low_stock_threshold — a
  // comparison between two columns, which PostgREST has no syntax for. It is
  // applied here and the footer says so rather than implying the query did
  // it.
  if (show) {
    rows = rows.filter((v) => {
      const out = v.stock_quantity === 0;
      const low = v.stock_quantity > 0 && v.stock_quantity <= v.low_stock_threshold;
      if (show === 'out') return out;
      if (show === 'low') return low;
      if (show === 'inactive') return !v.is_active;
      return out || low; // needs attention
    });
  }

  if (sort === 'product') {
    rows = [...rows].sort(
      (a, b) =>
        (a.products?.name ?? '').localeCompare(b.products?.name ?? '') ||
        a.colour.localeCompare(b.colour) ||
        compareSizes(a.size, b.size),
    );
  }

  const total = count ?? 0;
  const { count: attention } = await supabase
    .from('product_variants')
    .select('id', { count: 'exact', head: true })
    .eq('stock_quantity', 0);

  return (
    <div className="mc-admin-page">
      <div className="mc-admin-topbar">
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
            Inventory
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
            {total === 0
              ? 'No variants yet'
              : `${total} variant${total === 1 ? '' : 's'}${
                  attention ? ` · ${attention} sold out` : ''
                }`}
          </p>
        </div>
      </div>

      <div className="mc-admin-content">
        <InventoryToolbar
          q={q}
          show={show}
          product={product}
          sort={sort}
          products={(productList ?? []) as { id: string; name: string }[]}
        />

        <div
          style={{
            background: 'var(--mc-bg-surface)',
            border: '1px solid var(--mc-border-default)',
            borderRadius: 'var(--mc-radius-md)',
            padding: 18,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {rows.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--mc-text-muted)', margin: 0 }}>
              {q || show || product
                ? 'No variants match these filters on this page.'
                : 'No variants yet. They are generated from a T-shirt’s colours and sizes.'}
            </p>
          ) : (
            <>
              {/* Tablet and desktop: the six-column table (128:1324). */}
              <table className="mc-orders-table">
                <thead>
                  <tr>
                    <Th>SKU</Th>
                    <Th>Product</Th>
                    <Th>Variant</Th>
                    <Th>Stock</Th>
                    <Th>Threshold</Th>
                    <Th>State</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id} style={{ borderTop: '1px solid var(--mc-border-default)' }}>
                      <Td>
                        <Link href={`/admin/products/${v.product_id}/variants`} style={skuLinkStyle}>
                          {v.sku}
                        </Link>
                      </Td>
                      <Td>{v.products?.name ?? '—'}</Td>
                      <Td>
                        {v.colour} / {v.size}
                      </Td>
                      <Td>{v.stock_quantity}</Td>
                      <Td muted>{v.low_stock_threshold}</Td>
                      <Td>
                        <StateBadge variant={v} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile: one record per variant (128:901). */}
              <div className="mc-orders-records">
                {rows.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      borderTop: '1px solid var(--mc-border-default)',
                      padding: '14px 0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <Link href={`/admin/products/${v.product_id}/variants`} style={{ ...skuLinkStyle, fontSize: 15 }}>
                      {v.sku}
                    </Link>
                    <p style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)', margin: 0 }}>
                      Product: {v.products?.name ?? '—'} · Variant: {v.colour} / {v.size} · Stock:{' '}
                      {v.stock_quantity} · Threshold: {v.low_stock_threshold}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px' }}>
                      <StateBadge variant={v} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mc-admin-table-footer">
          <p style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)', margin: 0, maxWidth: 680 }}>
            Stock can never go below zero — a removal larger than what is on hand is rejected, not
            clamped. Every manual change needs a reason, and lands in inventory_adjustments with the
            person who made it.
            {show ? ' “Show” is applied to this page of results, because it compares stock against each variant’s own threshold and that is not something the database query can express.' : ''}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <PageLink params={params} page={page - 1} disabled={page === 1}>
              Previous
            </PageLink>
            <PageLink params={params} page={page + 1} disabled={from + (data ?? []).length >= total}>
              Next
            </PageLink>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The design's three states (128:1338/1386/1398): Low, Sold out, In stock.
 * `inactive` is a fourth that the frames never draw but the schema has, and
 * it matters here — an inactive variant with 40 in stock is not buyable, so
 * showing "In stock" against it would be wrong.
 */
const STATE: Record<string, { label: string; tone: BadgeTone }> = {
  out: { label: 'Sold out', tone: 'danger' },
  low: { label: 'Low', tone: 'attention' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  ok: { label: 'In stock', tone: 'success' },
};

function StateBadge({ variant }: { variant: VariantRow }) {
  const key = !variant.is_active
    ? 'inactive'
    : variant.stock_quantity === 0
      ? 'out'
      : variant.stock_quantity <= variant.low_stock_threshold
        ? 'low'
        : 'ok';
  return <StatusBadge label={STATE[key].label} tone={STATE[key].tone} />;
}

function PageLink({
  params,
  page,
  disabled,
  children,
}: {
  params: Record<string, string | string[] | undefined>;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    padding: '14px 24px',
    borderRadius: 'var(--mc-radius-sm)',
    fontFamily: 'var(--mc-font-body)',
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: '0.32px',
    textDecoration: 'none',
  };

  if (disabled) {
    return (
      <span aria-disabled style={{ ...base, color: 'var(--mc-text-muted)' }}>
        {children}
      </span>
    );
  }

  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === 'page') continue;
    const s = Array.isArray(v) ? v[0] : v;
    if (s) next.set(k, s);
  }
  if (page > 1) next.set('page', String(page));
  const qs = next.toString();
  return (
    <Link href={qs ? `/admin/inventory?${qs}` : '/admin/inventory'} style={{ ...base, color: 'var(--mc-text-primary)' }}>
      {children}
    </Link>
  );
}

const skuLinkStyle: React.CSSProperties = {
  fontFamily: 'var(--mc-font-body)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--mc-text-primary)',
};

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: '10px 12px 10px 0',
        textAlign: 'left',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '1.2px',
        textTransform: 'uppercase',
        color: 'var(--mc-text-muted)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td
      style={{
        padding: '13px 12px 13px 0',
        fontSize: 14,
        color: muted ? 'var(--mc-text-muted)' : 'var(--mc-text-primary)',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </td>
  );
}

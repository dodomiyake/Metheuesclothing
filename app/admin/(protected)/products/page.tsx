import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { formatPence } from '@/lib/money';
import { StatusBadge, type BadgeTone } from '@/components/admin/status-badge';
import { ProductsToolbar } from './products-toolbar';

const PAGE_SIZE = 25;

/**
 * A03 T-shirts — Figma 128:645 (Desktop) / 128:430 (Tablet) / 128:259
 * (Mobile). This screen existed before the admin shell did and had never
 * been matched against its frames: it was a bare table with a display-font
 * h1, no top bar, no toolbar, no footer, and no record list — so on a phone
 * it squashed four columns into 390px rather than scrolling or stacking.
 * Same shape as A11 and A17 now: table at 768 and up, one record per
 * product below, rail swapping at 1440.
 *
 * products_public_read (002_rls.sql) already resolves to "every status" for
 * a staff session, so this stays a plain select — no service role and no
 * second copy of the RLS rule to keep in sync.
 *
 * Omitted: "Import CSV", which the top bar draws beside "Add a T-shirt".
 * There is no route, no column mapping and no format. Same call A11 makes on
 * "Export orders" — the Button component says a disabled control must
 * explain itself, and an explanation of why a button does nothing is worse
 * than no button.
 *
 * PRICE is per VARIANT in this schema, not per product, so the column shows
 * the single price when every variant agrees and "from £X" when they do not.
 * The design shows one figure per row, which is only true while a product's
 * variants are all priced the same.
 */
type ProductRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  updated_at: string;
};

export default async function AdminProductsPage({
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
  const status = one('status');
  const collection = one('collection');
  const sort = one('sort');
  const page = Math.max(1, Number.parseInt(one('page') || '1', 10) || 1);

  const supabase = await createServerComponentClient();

  const { data: collections, error: collectionsError } = await supabase
    .from('collections')
    .select('id, name')
    .order('name');
  if (collectionsError) throw new Error(`Could not load collections: ${collectionsError.message}`);

  // A collection filter restricts through the join table, so the matching
  // product ids are resolved first — the same two-query shape A17's search
  // uses, and for the same reason: nothing here has ever run an embedded
  // PostgREST filter against a real database.
  let collectionProductIds: string[] | null = null;
  if (collection) {
    const { data, error: pcError } = await supabase
      .from('product_collections')
      .select('product_id')
      .eq('collection_id', collection);
    if (pcError) throw new Error(`Could not filter by collection: ${pcError.message}`);
    collectionProductIds = (data ?? []).map((r) => r.product_id as string);
  }

  let query = supabase
    .from('products')
    .select('id, slug, name, status, updated_at', { count: 'exact' });

  if (status) query = query.eq('status', status);
  if (q) {
    const safe = q.replace(/[%,()]/g, ' ');
    query = query.or(`name.ilike.%${safe}%,slug.ilike.%${safe}%`);
  }
  if (collectionProductIds) {
    // An empty collection matches nothing rather than everything.
    query = query.in('id', collectionProductIds.length ? collectionProductIds : ['']);
  }
  // "Lowest stock" cannot be an .order() — stock is a sum over variants, not
  // a column — so it is applied after the page is fetched and says so in the
  // footer rather than silently sorting one page.
  query = sort === 'name'
    ? query.order('name', { ascending: true })
    : query.order('updated_at', { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  const { data: products, error: productsError, count } = await query.range(from, from + PAGE_SIZE - 1);
  // A query error and an empty catalogue both leave `products` null; only the
  // second is "no products" (CLAUDE.md's swallowed-error note).
  if (productsError) throw new Error(`Could not load products: ${productsError.message}`);

  const rows = (products ?? []) as ProductRow[];
  const productIds = rows.map((p) => p.id);

  const { data: variants, error: variantsError } = productIds.length
    ? await supabase
        .from('product_variants')
        .select('product_id, stock_quantity, is_active, price_pence')
        .in('product_id', productIds)
    : {
        data: [] as { product_id: string; stock_quantity: number; is_active: boolean; price_pence: number }[],
        error: null,
      };
  if (variantsError) throw new Error(`Could not load variants: ${variantsError.message}`);

  const { data: memberships, error: membershipError } = productIds.length
    ? await supabase
        .from('product_collections')
        .select('product_id, position, collections(name)')
        .in('product_id', productIds)
        .order('position', { ascending: true })
    : { data: [] as { product_id: string; position: number; collections: { name: string } | null }[], error: null };
  if (membershipError) throw new Error(`Could not load collection membership: ${membershipError.message}`);

  const stats = new Map<string, { total: number; active: number; prices: number[] }>();
  for (const v of variants ?? []) {
    const entry = stats.get(v.product_id) ?? { total: 0, active: 0, prices: [] };
    entry.total += v.stock_quantity;
    if (v.is_active) entry.active += 1;
    entry.prices.push(v.price_pence);
    stats.set(v.product_id, entry);
  }

  const collectionName = new Map<string, string>();
  for (const m of (memberships ?? []) as unknown as {
    product_id: string;
    collections: { name: string } | null;
  }[]) {
    // Ordered by position, so the first one seen is the primary.
    if (!collectionName.has(m.product_id) && m.collections?.name) {
      collectionName.set(m.product_id, m.collections.name);
    }
  }

  let display = rows;
  if (sort === 'stock') {
    display = [...rows].sort(
      (a, b) => (stats.get(a.id)?.total ?? 0) - (stats.get(b.id)?.total ?? 0),
    );
  }

  const total = count ?? 0;
  const filtered = Boolean(q || status || collection);

  return (
    <div className="mc-admin-page">
      <div className="mc-admin-topbar">
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
            T-shirts
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
            {total === 0
              ? 'No products yet'
              : `${total} product${total === 1 ? '' : 's'}${filtered ? ' matching these filters' : ''}`}
          </p>
        </div>
        <Link href="/admin/products/new" style={primaryButtonStyle}>
          Add a T-shirt
        </Link>
      </div>

      <div className="mc-admin-content">
        <ProductsToolbar
          q={q}
          status={status}
          collection={collection}
          sort={sort}
          collections={(collections ?? []) as { id: string; name: string }[]}
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
          {display.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--mc-text-muted)', margin: 0 }}>
              {filtered
                ? 'No T-shirts match these filters.'
                : 'No products yet. “Add a T-shirt” starts one.'}
            </p>
          ) : (
            <>
              {/* Tablet and desktop: the seven-column table (128:749). */}
              <table className="mc-orders-table">
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th>Collection</Th>
                    <Th>Status</Th>
                    <Th>Variants</Th>
                    <Th>Stock</Th>
                    <Th>Price</Th>
                    <Th>Updated</Th>
                  </tr>
                </thead>
                <tbody>
                  {display.map((p) => {
                    const s = stats.get(p.id) ?? { total: 0, active: 0, prices: [] };
                    return (
                      <tr key={p.id} style={{ borderTop: '1px solid var(--mc-border-default)' }}>
                        <Td>
                          <Link href={`/admin/products/${p.id}`} style={nameLinkStyle}>
                            {p.name}
                          </Link>
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--mc-text-muted)' }}>
                            {p.slug}
                          </span>
                        </Td>
                        <Td>{collectionName.get(p.id) ?? '—'}</Td>
                        <Td>
                          <ProductStatusBadge status={derivedStatus(p.status, s.total)} />
                        </Td>
                        <Td>{s.active}</Td>
                        <Td>{s.total}</Td>
                        <Td>{priceLabel(s.prices)}</Td>
                        <Td muted>{formatUpdated(p.updated_at)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile: one record per product (128:286) — name, a single
                  meta line, then the badge. */}
              <div className="mc-orders-records">
                {display.map((p) => {
                  const s = stats.get(p.id) ?? { total: 0, active: 0, prices: [] };
                  return (
                    <div
                      key={p.id}
                      style={{
                        borderTop: '1px solid var(--mc-border-default)',
                        padding: '14px 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <Link href={`/admin/products/${p.id}`} style={{ ...nameLinkStyle, fontSize: 15 }}>
                        {p.name}
                      </Link>
                      <p style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)', margin: 0 }}>
                        Collection: {collectionName.get(p.id) ?? '—'} · Variants: {s.active} · Stock:{' '}
                        {s.total} · Price: {priceLabel(s.prices)} · Updated: {formatUpdated(p.updated_at)}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px' }}>
                        <ProductStatusBadge status={derivedStatus(p.status, s.total)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="mc-admin-table-footer">
          <p style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)', margin: 0 }}>
            {total === 0
              ? 'No products'
              : `Showing ${from + 1}–${Math.min(from + display.length, total)} of ${total}`}
            {sort === 'stock' ? ' · lowest stock first within this page, because stock is a sum over variants rather than a column' : ''}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <PageLink params={params} page={page - 1} disabled={page === 1}>
              Previous
            </PageLink>
            <PageLink params={params} page={page + 1} disabled={from + display.length >= total}>
              Next
            </PageLink>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Sold out" is not a products.status — it is published with nothing left,
 * which is a different thing from archived and worth saying. */
function derivedStatus(status: string, stock: number): string {
  return status === 'published' && stock === 0 ? 'sold_out' : status;
}

/** One figure when every variant agrees, a range when they do not. */
function priceLabel(prices: number[]): string {
  if (!prices.length) return '—';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPence(min) : `from ${formatPence(min)}`;
}

/** "2 Sept" — the design's format (128:768). */
function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
    <Link href={qs ? `/admin/products?${qs}` : '/admin/products'} style={{ ...base, color: 'var(--mc-text-primary)' }}>
      {children}
    </Link>
  );
}

const nameLinkStyle: React.CSSProperties = {
  fontFamily: 'var(--mc-font-body)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--mc-text-primary)',
};

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '14px 24px',
  background: 'var(--mc-action-primary-bg)',
  color: 'var(--mc-action-primary-text)',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: '0.32px',
  textDecoration: 'none',
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

/**
 * products.status, as the shared Status Badge. This used to be a local badge
 * with its own tone map carrying four hardcoded pastel hexes (#DCEBF7,
 * #1E4F73, #E4F1E8, #F5E6D8) that were in no palette this project has ever
 * had — they survived both the warm-to-cool and cool-to-stark recolours
 * because nothing referencing a raw hex gets swept by a token change.
 *
 * `sold_out` is Danger, not Attention: A03 draws it that way (128:816), and
 * it is the one state here that costs a sale right now.
 */
const PRODUCT_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  published: { label: 'Published', tone: 'success' },
  archived: { label: 'Archived', tone: 'neutral' },
  sold_out: { label: 'Sold out', tone: 'danger' },
};

function ProductStatusBadge({ status }: { status: string }) {
  const entry = PRODUCT_BADGE[status] ?? { label: status, tone: 'neutral' as const };
  return <StatusBadge label={entry.label} tone={entry.tone} />;
}

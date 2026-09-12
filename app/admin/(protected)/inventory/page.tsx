import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';

/**
 * A07 Inventory table. Sorted lowest stock first, threshold shown beside the
 * count so "low" is explainable rather than asserted. Read-only here by
 * design — the actual adjustment form lives on each product's variants page
 * (A08), so there is exactly one place that calls adjust_stock, not two
 * copies of the same form to keep in sync.
 */
export default async function AdminInventoryPage() {
  const supabase = await createServerComponentClient();

  const { data: variants, error } = await supabase
    .from('product_variants')
    .select('id, colour, size, sku, stock_quantity, low_stock_threshold, is_active, product_id, products(name)')
    .order('stock_quantity', { ascending: true });
  // See app/shop/page.tsx's comment -- a query error must not render as an
  // empty inventory.
  if (error) throw new Error(`Could not load inventory: ${error.message}`);

  return (
    <div style={{ padding: 'var(--mc-space-xl)', fontFamily: 'var(--mc-font-body)' }}>
      <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)' }}>
        Inventory
      </h1>

      {!variants?.length ? (
        <p style={{ color: 'var(--mc-text-muted)' }}>No variants yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--mc-border-default)', textAlign: 'left' }}>
              <Th>Product</Th>
              <Th>SKU</Th>
              <Th>Stock</Th>
              <Th>Threshold</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v: any) => {
              const low = v.stock_quantity > 0 && v.stock_quantity <= v.low_stock_threshold;
              const out = v.stock_quantity === 0;
              return (
                <tr key={v.id} style={{ borderBottom: '1px solid var(--mc-border-default)' }}>
                  <Td>
                    <Link
                      href={`/admin/products/${v.product_id}/variants`}
                      style={{ color: 'var(--mc-text-primary)', textDecoration: 'none' }}
                    >
                      {v.products?.name} — {v.colour} / {v.size}
                    </Link>
                  </Td>
                  <Td>{v.sku}</Td>
                  <Td>{v.stock_quantity}</Td>
                  <Td>{v.low_stock_threshold}</Td>
                  <Td>
                    {out ? (
                      <Badge tone="danger">Out of stock</Badge>
                    ) : low ? (
                      <Badge tone="attention">Low</Badge>
                    ) : v.is_active ? (
                      <Badge tone="success">OK</Badge>
                    ) : (
                      <Badge tone="neutral">Inactive</Badge>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p style={{ color: 'var(--mc-text-muted)', fontSize: 'var(--mc-type-caption)', marginTop: 'var(--mc-space-lg)' }}>
        Stock can never go negative — a removal larger than what&rsquo;s on hand is rejected, not
        clamped to zero. Every manual change requires a reason and is written to the audit log.
      </p>
    </div>
  );
}

const TONES: Record<string, { bg: string; fg: string }> = {
  danger: { bg: '#F5E6D8', fg: 'var(--mc-red)' },
  attention: { bg: '#F5E6D8', fg: 'var(--mc-oxblood)' },
  success: { bg: '#E4F1E8', fg: 'var(--mc-forest)' },
  neutral: { bg: 'var(--mc-sand)', fg: 'var(--mc-stone)' },
};

function Badge({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontSize: 'var(--mc-type-caption)',
        fontWeight: 600,
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: t.fg }} />
      {children}
    </span>
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

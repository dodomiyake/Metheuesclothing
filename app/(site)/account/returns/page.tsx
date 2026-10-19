import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { requireCustomerPage } from '@/lib/account/require-customer';
import { AccountShell } from '@/components/site/account-shell';
import { formatPence } from '@/lib/money';

export const metadata = { title: 'Your returns — Metheues Clothings' };

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

const STATUS_WORDS: Record<string, string> = {
  requested: 'Requested',
  approved: 'Approved',
  received: 'Received and being checked',
  rejected: 'Not accepted',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
};

/**
 * Returns — the one item in the account rail with NO frame of its own.
 *
 * The rail in 11, 12, 13, 18 and 30 all draw five items and Returns is the
 * third, but the design file has 17 Return Details and no list in front of
 * it. Rather than leave a rail item that 404s — the same call A11 made
 * about the seven admin items whose pages did not exist — this is built
 * from the grammar the cluster already uses: 12 Orders' card, 17's status
 * words, and the same progress language as 13.
 *
 * WORTH SETTLING WITH THE DESIGN OWNER, alongside the other open naming
 * questions: whether Returns is its own screen or a section of 12 Orders.
 *
 * APPROVAL SENDS NO EMAIL, which CLAUDE.md records as the design's own
 * behaviour (E6 on request, E7 only when the money has left). So between
 * requesting and being refunded, this page is the only place a customer
 * can see where their return has got to — which is a reason to have it.
 */
export default async function AccountReturnsPage() {
  await requireCustomerPage('/account/returns');
  const supabase = await createServerComponentClient();

  // returns_own scopes this to the caller.
  const { data, error } = await supabase
    .from('returns')
    .select(
      'id, return_number, status, requested_at, received_at, order_id, orders(order_number), return_items(quantity, order_items(product_name, colour, size, unit_price_pence))',
    )
    .order('requested_at', { ascending: false });
  if (error) throw new Error(`Could not load your returns: ${error.message}`);

  type ReturnRow = {
    id: string;
    return_number: string;
    status: string;
    requested_at: string;
    received_at: string | null;
    orders: { order_number: string } | null;
    return_items: {
      quantity: number;
      order_items: { product_name: string; colour: string; size: string; unit_price_pence: number } | null;
    }[];
  };
  const returns = (data ?? []) as unknown as ReturnRow[];

  const refundsQuery = returns.length
    ? await supabase
        .from('refunds')
        .select('return_id, amount_pence')
        .in('return_id', returns.map((r) => r.id))
    : { data: [], error: null };
  if (refundsQuery.error) throw new Error(`Could not load refunds: ${refundsQuery.error.message}`);

  const refundByReturn = new Map<string, number>();
  for (const r of (refundsQuery.data ?? []) as { return_id: string | null; amount_pence: number }[]) {
    if (!r.return_id) continue;
    refundByReturn.set(r.return_id, (refundByReturn.get(r.return_id) ?? 0) + r.amount_pence);
  }

  return (
    <AccountShell
      current="returns"
      eyebrow="Your account"
      title="Returns"
      meta={returns.length === 0 ? 'None requested' : `${returns.length} ${returns.length === 1 ? 'return' : 'returns'}`}
    >
      <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)' }}>
          A return starts from the order it belongs to. Once it is on its way to us, this is where
          it is: we check every parcel at the atelier before the refund is sent.
        </p>

        {returns.length === 0 ? (
          <div
            style={{
              background: 'var(--mc-bg-surface)',
              border: '1px solid var(--mc-border-default)',
              borderRadius: 4,
              padding: 28,
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>No returns yet</p>
            <p style={{ margin: '8px 0 16px', fontSize: 14, color: 'var(--mc-text-muted)' }}>
              Returns open once an order is delivered. Start one from the order itself so we know
              which items are coming back.
            </p>
            <Link href="/account/orders" className="mc-button-secondary">
              Your orders
            </Link>
          </div>
        ) : (
          returns.map((ret) => {
            const refunded = refundByReturn.get(ret.id) ?? 0;
            const expected = ret.return_items.reduce(
              (n, line) => n + line.quantity * (line.order_items?.unit_price_pence ?? 0),
              0,
            );
            return (
              <article
                key={ret.id}
                style={{
                  background: 'var(--mc-bg-surface)',
                  border: '1px solid var(--mc-border-default)',
                  borderRadius: 4,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 0 0', minWidth: 180 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Return {ret.return_number}</h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--mc-text-muted)' }}>
                      Requested {new Date(ret.requested_at).toLocaleDateString('en-GB', DATE)}
                      {ret.orders?.order_number ? ` · Order ${ret.orders.order_number}` : ''}
                    </p>
                  </div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '7px 12px',
                      borderRadius: 999,
                      border: '1px solid var(--mc-border-default)',
                      fontSize: 13,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {STATUS_WORDS[ret.status] ?? ret.status}
                  </span>
                </div>

                <div style={{ height: 1, background: 'var(--mc-border-default)' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ret.return_items.map((line, i) => (
                    <p key={i} style={{ margin: 0, fontSize: 15 }}>
                      {line.order_items?.product_name ?? 'Item'} — {line.order_items?.colour ?? ''} /{' '}
                      {line.order_items?.size ?? ''} × {line.quantity}
                    </p>
                  ))}
                </div>

                <p style={{ margin: 0, fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)' }}>
                  {refunded > 0
                    ? `${formatPence(refunded)} refunded. Refunds take 5–10 working days to appear.`
                    : ret.received_at
                      ? `Received ${new Date(ret.received_at).toLocaleDateString('en-GB', DATE)} and being checked. We will email you when the refund is sent.`
                      : `Expected refund ${formatPence(expected)} once the items are back and checked. Original delivery is not refunded.`}
                </p>

                {ret.orders?.order_number && (
                  <div>
                    <Link href={`/account/orders/${ret.orders.order_number}`} className="mc-button-ghost" style={{ paddingLeft: 0 }}>
                      View the order
                    </Link>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </AccountShell>
  );
}

import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { requireCustomerPage } from '@/lib/account/require-customer';
import { AccountShell } from '@/components/site/account-shell';
import { OrderStatusPill } from '@/components/site/order-status-pill';
import { formatPence } from '@/lib/money';
import { cardLabel } from '@/lib/payments/card-label';

export const metadata = { title: 'Your orders — Metheues Clothings' };

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };

type OrderRow = {
  id: string;
  order_number: string;
  placed_at: string;
  total_pence: number;
  payment_status: string;
  fulfilment_status: string;
  cancelled_at: string | null;
  delivery_method: string | null;
};

/**
 * 12 Orders — Figma 102:3304 (Desktop, pulled). The ledger says this screen
 * was built by cloning 11's shell and replacing the content column, which
 * is exactly how it is built here: AccountShell is the clone.
 *
 * The content column is capped at 820px, which the frame does deliberately
 * — "so the total is not an eye-travel from its label".
 *
 * THE CONTEXTUAL LINE UNDER EACH ORDER IS THE ONE THING THAT NEEDED REAL
 * DATA RATHER THAN THE DESIGN'S WORDS. The frame writes three different
 * sentences for three states, and only two of them are things this system
 * knows:
 *
 *  - Preparing: "Estimated delivery 12–16 September, tracked with DPD".
 *    Nothing computes a delivery estimate and no carrier is configured
 *    anywhere (A14's carrier field is free text for that reason), so this
 *    becomes the real delivery method, and the carrier and tracking number
 *    only once a fulfilment row actually carries them.
 *  - Delivered: "Returns close 14 September — 30 days from delivery" is
 *    REAL. delivered_at plus store_settings.return_window_days, the same
 *    window request_return() itself enforces.
 *  - Refunded: "Refunded to the original payment method" is real, and now
 *    names the card where the payment recorded one.
 *
 * "Start a return" appears only where a return is genuinely possible, for
 * the reason the Button component gives: a disabled control needs text
 * saying what would enable it, and the delivered line already says when
 * the window closes.
 */
export default async function AccountOrdersPage() {
  const customer = await requireCustomerPage('/account/orders');
  const supabase = await createServerComponentClient();

  // RLS (orders_own_read) is the filter — see the note in the overview.
  const { data: orderRows, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, placed_at, total_pence, payment_status, fulfilment_status, cancelled_at, delivery_method',
    )
    .order('placed_at', { ascending: false });
  if (error) throw new Error(`Could not load your orders: ${error.message}`);

  const orders = (orderRows ?? []) as OrderRow[];
  const ids = orders.map((o) => o.id);

  const [itemsQuery, fulfilmentsQuery, settingsQuery, refundsQuery, paymentsQuery] = await Promise.all([
    ids.length
      ? supabase
          .from('order_items')
          .select('order_id, product_name, colour, size, quantity')
          .in('order_id', ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase.from('fulfilments').select('order_id, carrier, tracking_number, shipped_at, delivered_at').in('order_id', ids)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('store_settings').select('return_window_days').single(),
    ids.length
      ? supabase.from('refunds').select('order_id, amount_pence, created_at').in('order_id', ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase.from('payments').select('order_id, card_brand, card_last4').in('order_id', ids)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (itemsQuery.error) throw new Error(`Could not load your orders: ${itemsQuery.error.message}`);
  if (fulfilmentsQuery.error) throw new Error(`Could not load delivery details: ${fulfilmentsQuery.error.message}`);
  if (settingsQuery.error) throw new Error(`Could not load store settings: ${settingsQuery.error.message}`);
  if (refundsQuery.error) throw new Error(`Could not load refunds: ${refundsQuery.error.message}`);
  if (paymentsQuery.error) throw new Error(`Could not load payments: ${paymentsQuery.error.message}`);

  type ItemRow = { order_id: string; product_name: string; colour: string; size: string; quantity: number };
  const itemsByOrder = new Map<string, ItemRow[]>();
  for (const item of (itemsQuery.data ?? []) as ItemRow[]) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }

  type FulfilmentRow = {
    order_id: string;
    carrier: string;
    tracking_number: string;
    shipped_at: string | null;
    delivered_at: string | null;
  };
  const fulfilmentByOrder = new Map<string, FulfilmentRow>();
  for (const f of (fulfilmentsQuery.data ?? []) as FulfilmentRow[]) {
    const existing = fulfilmentByOrder.get(f.order_id);
    if (!existing || (f.shipped_at ?? '') > (existing.shipped_at ?? '')) {
      fulfilmentByOrder.set(f.order_id, f);
    }
  }

  const refundByOrder = new Map<string, { total: number; latest: string | null }>();
  for (const r of (refundsQuery.data ?? []) as { order_id: string; amount_pence: number; created_at: string }[]) {
    const entry = refundByOrder.get(r.order_id) ?? { total: 0, latest: null };
    entry.total += r.amount_pence;
    if (!entry.latest || r.created_at > entry.latest) entry.latest = r.created_at;
    refundByOrder.set(r.order_id, entry);
  }

  const cardByOrder = new Map<string, string>();
  for (const p of (paymentsQuery.data ?? []) as {
    order_id: string;
    card_brand: string | null;
    card_last4: string | null;
  }[]) {
    cardByOrder.set(p.order_id, cardLabel(p.card_brand, p.card_last4));
  }

  const returnWindowDays = settingsQuery.data.return_window_days as number;

  return (
    <AccountShell
      current="orders"
      eyebrow="Your account"
      title="Orders"
      meta={`${orders.length === 0 ? 'No orders yet' : `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`} · ${customer.email}`}
    >
      <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
            {orders.length === 0 ? 'Nothing here yet' : `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`}
          </p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)' }}>
            Everything you have ordered from Metheues, newest first. Order numbers are the reference
            to quote if you contact us.
          </p>
        </div>

        {orders.map((order) => {
          const items = itemsByOrder.get(order.id) ?? [];
          const unitCount = items.reduce((n, i) => n + i.quantity, 0);
          const fulfilment = fulfilmentByOrder.get(order.id) ?? null;
          const refund = refundByOrder.get(order.id) ?? null;
          const deliveredAt = fulfilment?.delivered_at ?? null;

          const returnsCloseAt = deliveredAt
            ? new Date(new Date(deliveredAt).getTime() + returnWindowDays * 86_400_000)
            : null;
          const returnOpen = returnsCloseAt ? returnsCloseAt.getTime() > Date.now() : false;

          return (
            <article
              key={order.id}
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
                <div style={{ flex: '1 0 0', minWidth: 180, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Order {order.order_number}</h2>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--mc-text-muted)' }}>
                    Placed {new Date(order.placed_at).toLocaleDateString('en-GB', DATE)}
                  </p>
                </div>
                <OrderStatusPill
                  order={order}
                  suffix={
                    deliveredAt && order.fulfilment_status === 'delivered'
                      ? new Date(deliveredAt).toLocaleDateString('en-GB', SHORT_DATE)
                      : null
                  }
                />
              </div>

              <div style={{ height: 1, background: 'var(--mc-border-default)', width: '100%' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 15, color: 'var(--mc-text-muted)' }}>
                    No item lines recorded on this order.
                  </p>
                ) : (
                  items.map((item, i) => (
                    <p key={`${item.product_name}-${i}`} style={{ margin: 0, fontSize: 15 }}>
                      {item.product_name} — {item.colour} / {item.size} × {item.quantity}
                    </p>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--mc-text-muted)' }}>
                  {unitCount} {unitCount === 1 ? 'item' : 'items'} ·{' '}
                  {refund
                    ? `Refunded ${refund.latest ? new Date(refund.latest).toLocaleDateString('en-GB', SHORT_DATE) : ''}`.trim()
                    : order.payment_status === 'paid'
                      ? 'Total paid'
                      : 'Total'}
                </p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{formatPence(order.total_pence)}</p>
              </div>

              <p style={{ margin: 0, fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)' }}>
                {contextLine({
                  order,
                  fulfilment,
                  refunded: Boolean(refund),
                  card: cardByOrder.get(order.id) ?? 'the card that paid',
                  returnsCloseAt,
                  returnWindowDays,
                })}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 12px' }}>
                <Link href={`/account/orders/${order.order_number}`} className="mc-button-secondary">
                  View order
                </Link>
                {fulfilment?.tracking_number && (
                  <Link href={`/account/orders/${order.order_number}`} className="mc-button-ghost">
                    Track parcel
                  </Link>
                )}
                {returnOpen && (
                  <Link href={`/account/orders/${order.order_number}#return`} className="mc-button-ghost">
                    Start a return
                  </Link>
                )}
              </div>
            </article>
          );
        })}

        {/* 102:3478. Real and necessary: a guest order has no profile_id, so
            RLS cannot show it here however the customer signs in — and the
            page that CAN show it, by re-proving the order number and the
            email together, already exists. */}
        <div
          style={{
            background: 'var(--mc-bg-page)',
            border: '1px solid var(--mc-border-default)',
            borderRadius: 4,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            alignItems: 'flex-start',
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Missing an order?</p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)' }}>
            Orders placed as a guest are not listed here. Use the order number and email from your
            confirmation to look one up, or contact us and we will find it.
          </p>
          <Link href="/track-order" className="mc-button-ghost" style={{ paddingLeft: 0 }}>
            Look up a guest order
          </Link>
        </div>
      </div>
    </AccountShell>
  );
}

function contextLine({
  order,
  fulfilment,
  refunded,
  card,
  returnsCloseAt,
  returnWindowDays,
}: {
  order: OrderRow;
  fulfilment: { carrier: string; tracking_number: string } | null;
  refunded: boolean;
  card: string;
  returnsCloseAt: Date | null;
  returnWindowDays: number;
}): string {
  if (order.cancelled_at) {
    return `Cancelled on ${new Date(order.cancelled_at).toLocaleDateString('en-GB', DATE)}.`;
  }
  if (refunded) {
    return `Refunded to ${card}. Refunds take 5–10 working days to appear.`;
  }
  if (returnsCloseAt) {
    const closed = returnsCloseAt.getTime() < Date.now();
    return `${closed ? 'Returns closed' : 'Returns close'} ${returnsCloseAt.toLocaleDateString('en-GB', DATE)} — ${returnWindowDays} days from delivery.`;
  }
  if (fulfilment?.tracking_number) {
    return `On its way with ${fulfilment.carrier} — tracking ${fulfilment.tracking_number}.`;
  }
  if (order.payment_status === 'paid') {
    return order.delivery_method === 'next_day'
      ? 'Next-day delivery. We will email tracking as soon as it leaves us.'
      : 'Tracked 48 delivery. We will email tracking as soon as it leaves us.';
  }
  return 'This order has not been paid for, so nothing has been sent.';
}

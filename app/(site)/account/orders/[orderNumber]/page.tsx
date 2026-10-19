import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { requireCustomerPage } from '@/lib/account/require-customer';
import { AccountShell } from '@/components/site/account-shell';
import { OrderStatusPill } from '@/components/site/order-status-pill';
import { OrderTimeline } from '@/components/site/order-timeline';
import { buildOrderTimeline } from '@/lib/orders/status';
import { OrderReturnPanel } from './return-panel';
import { formatPence } from '@/lib/money';
import { cardName } from '@/lib/payments/card-label';
import { loadVariantImages } from '@/lib/admin/variant-images';

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

const DELIVERY_METHOD_LABELS: Record<string, string> = {
  tracked_48: 'Tracked 48',
  next_day: 'Next working day',
};

/**
 * 13 Order Detail — Figma 103:3631 (Desktop). The same node /track-order's
 * result view was built from, which is the point: this is that screen WITH
 * its account chrome rather than a second design.
 *
 * Two columns at 1440 (main FILL plus a 320px rail, capped at 1000), one
 * below it — read off the frame, and the ledger's own note says tablet and
 * mobile stack.
 *
 * WHAT THE FRAME DRAWS THAT IS NOT HERE, each for its own reason:
 *
 *  - "Cancel this order" with "Orders can be cancelled until they are
 *    dispatched". There is no customer-facing cancel route — A15 is staff
 *    only, and cancelling issues a Stripe refund. A button that cannot act
 *    is a dead end (the Button component's own rule), so the panel says
 *    what to do instead and links to a real address.
 *  - "Download invoice". Nothing generates one. The order summary below it
 *    carries every figure an invoice would.
 *  - The billing address under PAYMENT. orders.billing_address is a column
 *    nothing writes — unchanged by the webhook work, which only closed the
 *    card.
 *  - "Expected 10 September" on the two unreached timeline steps. The
 *    schema has no per-transition timestamps and nothing computes an
 *    estimate, so a step shows a date only where one is really recorded.
 *
 * PAYMENT METHOD IS REAL where the payment recorded a card, which it does
 * for anything paid since the webhook started expanding latest_charge.
 */
export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const customer = await requireCustomerPage(`/account/orders/${orderNumber}`);
  const supabase = await createServerComponentClient();

  // orders_own_read is what stops this being another customer's order: the
  // policy matches profile_id against auth.uid(), so a guessed order number
  // returns no row rather than someone else's purchase.
  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, placed_at, subtotal_pence, delivery_pence, total_pence, payment_status, fulfilment_status, cancelled_at, delivery_method, delivery_address, customer_note',
    )
    .eq('order_number', orderNumber)
    .maybeSingle();

  // A query error and an order that is not this customer's both leave
  // `order` null; only the second is a 404 (CLAUDE.md's swallowed-error
  // note). Not found rather than forbidden on purpose — telling someone an
  // order exists but is not theirs is the oracle rule 6 exists to avoid.
  if (error) throw new Error(`Could not load this order: ${error.message}`);
  if (!order) notFound();

  const [itemsQuery, fulfilmentsQuery, paymentQuery, settingsQuery, refundsQuery, returnsQuery] =
    await Promise.all([
      supabase
        .from('order_items')
        .select('id, variant_id, product_name, colour, size, quantity, unit_price_pence, line_total_pence')
        .eq('order_id', order.id),
      supabase
        .from('fulfilments')
        .select('carrier, tracking_number, tracking_url, shipped_at, delivered_at')
        .eq('order_id', order.id)
        .order('shipped_at', { ascending: false }),
      supabase
        .from('payments')
        .select('card_brand, card_last4, created_at, amount_pence')
        .eq('order_id', order.id)
        .maybeSingle(),
      supabase.from('store_settings').select('return_window_days, vat_rate_basis_points, contact_email').single(),
      supabase.from('refunds').select('amount_pence, created_at').eq('order_id', order.id),
      supabase.from('returns').select('return_number, status, requested_at').eq('order_id', order.id),
    ]);

  if (itemsQuery.error) throw new Error(`Could not load this order: ${itemsQuery.error.message}`);
  if (fulfilmentsQuery.error) throw new Error(`Could not load delivery: ${fulfilmentsQuery.error.message}`);
  if (paymentQuery.error) throw new Error(`Could not load the payment: ${paymentQuery.error.message}`);
  if (settingsQuery.error) throw new Error(`Could not load store settings: ${settingsQuery.error.message}`);
  if (refundsQuery.error) throw new Error(`Could not load refunds: ${refundsQuery.error.message}`);
  if (returnsQuery.error) throw new Error(`Could not load returns: ${returnsQuery.error.message}`);

  type ItemRow = {
    id: string;
    variant_id: string | null;
    product_name: string;
    colour: string;
    size: string;
    quantity: number;
    unit_price_pence: number;
    line_total_pence: number;
  };
  const items = (itemsQuery.data ?? []) as ItemRow[];
  const unitCount = items.reduce((n, i) => n + i.quantity, 0);

  // The photograph for each line's own colourway, where one has been
  // uploaded (A05). Same helper the admin's pick list uses.
  const images = await loadVariantImages(supabase, items.map((i) => i.variant_id));

  const fulfilments = (fulfilmentsQuery.data ?? []) as {
    carrier: string;
    tracking_number: string;
    tracking_url: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
  }[];
  const shipped = fulfilments[0] ?? null;
  const deliveredAt = fulfilments.find((f) => f.delivered_at)?.delivered_at ?? null;

  const refundedPence = (refundsQuery.data ?? []).reduce(
    (n, r) => n + (r.amount_pence as number),
    0,
  );

  const vatRate = (settingsQuery.data.vat_rate_basis_points as number) / 10_000;
  // VAT is INCLUDED in every price (A22's own note says so, and UK law
  // requires it), so this is the VAT within the total rather than on top.
  const vatIncluded = Math.round(order.total_pence - order.total_pence / (1 + vatRate));

  const address = (order.delivery_address ?? {}) as Record<string, unknown>;
  const addressLines = formatAddress(address);
  const contactEmail = settingsQuery.data.contact_email as string;

  return (
    <AccountShell
      current="orders"
      eyebrow="Your account"
      title="Order details"
      meta={`${order.order_number} · Placed ${new Date(order.placed_at).toLocaleDateString('en-GB', DATE)}`}
    >
      <div style={{ maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Link href="/account/orders" style={{ fontSize: 14, color: 'var(--mc-text-muted)' }}>
          ← All orders
        </Link>

        <div
          style={{
            background: 'var(--mc-bg-surface)',
            border: '1px solid var(--mc-border-default)',
            borderRadius: 4,
            padding: 20,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 0 0', minWidth: 180 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Order {order.order_number}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--mc-text-muted)' }}>
              Placed {new Date(order.placed_at).toLocaleDateString('en-GB', DATE)} · {unitCount}{' '}
              {unitCount === 1 ? 'item' : 'items'} · {formatPence(order.total_pence)}
            </p>
          </div>
          <OrderStatusPill order={order} />
        </div>

        <div className="mc-account-order-layout">
          <div className="mc-account-order-main">
            <Card title="Progress">
              <OrderTimeline
                steps={buildOrderTimeline(order, shipped?.shipped_at ?? null, deliveredAt)}
              />
            </Card>

            <Card title="Items in this order">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {items.map((item) => {
                  const image = images.get(item.variant_id ?? '');
                  return (
                    <div key={item.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      <span
                        aria-hidden
                        style={{
                          width: 44,
                          height: 55,
                          flexShrink: 0,
                          background: 'var(--mc-mist)',
                          borderRadius: 2,
                          overflow: 'hidden',
                          display: 'block',
                        }}
                      >
                        {image && (
                          <img
                            src={image.url}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        )}
                      </span>
                      <div style={{ flex: '1 0 0', minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{item.product_name}</p>
                        <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--mc-text-muted)' }}>
                          {item.colour} / {item.size}
                        </p>
                        <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--mc-text-muted)' }}>
                          Quantity {item.quantity}
                        </p>
                      </div>
                      <p style={{ margin: 0, fontSize: 15, whiteSpace: 'nowrap' }}>
                        {formatPence(item.line_total_pence)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Delivery">
              {addressLines.length > 0 ? (
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                  {addressLines.map((line) => (
                    <p key={line} style={{ margin: 0 }}>
                      {line}
                    </p>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: 'var(--mc-text-muted)' }}>
                  No delivery address recorded on this order yet — Stripe writes it when the payment
                  completes.
                </p>
              )}
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Row
                  label="Method"
                  value={DELIVERY_METHOD_LABELS[order.delivery_method as string] ?? (order.delivery_method as string)}
                />
                {shipped?.tracking_number && (
                  <Row label="Tracking number" value={`${shipped.carrier} ${shipped.tracking_number}`} />
                )}
              </div>
              {shipped?.tracking_url && (
                <p style={{ margin: '14px 0 0' }}>
                  <a
                    href={shipped.tracking_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mc-button-secondary"
                    style={{ width: '100%' }}
                  >
                    Track parcel
                  </a>
                </p>
              )}
              {order.customer_note && (
                <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--mc-text-muted)' }}>
                  Your note: “{order.customer_note as string}”
                </p>
              )}
            </Card>

            <Card title="Payment">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Row
                  label="Method"
                  value={
                    cardName(paymentQuery.data?.card_brand, paymentQuery.data?.card_last4) ??
                    'Card — details not recorded for this payment'
                  }
                />
                <Row
                  label="Charged"
                  value={
                    paymentQuery.data?.created_at
                      ? new Date(paymentQuery.data.created_at as string).toLocaleDateString('en-GB', DATE)
                      : new Date(order.placed_at).toLocaleDateString('en-GB', DATE)
                  }
                />
                {refundedPence > 0 && <Row label="Refunded" value={formatPence(refundedPence)} />}
              </div>
            </Card>
          </div>

          <div className="mc-account-order-side">
            <Card title="Order summary">
              <SummaryRow label={`Subtotal (${unitCount} ${unitCount === 1 ? 'item' : 'items'})`} value={formatPence(order.subtotal_pence)} />
              <SummaryRow
                label={`Delivery — ${DELIVERY_METHOD_LABELS[order.delivery_method as string] ?? order.delivery_method}`}
                value={order.delivery_pence === 0 ? 'Free' : formatPence(order.delivery_pence)}
              />
              <SummaryRow label="VAT included" value={formatPence(vatIncluded)} />
              <div style={{ height: 1, background: 'var(--mc-border-default)', margin: '8px 0' }} />
              <SummaryRow
                label={order.payment_status === 'paid' ? 'Total paid' : 'Total'}
                value={formatPence(order.total_pence)}
                big
              />
              {refundedPence > 0 && <SummaryRow label="Refunded" value={`−${formatPence(refundedPence)}`} />}
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--mc-text-muted)' }}>
                Paid in GBP. VAT is included in the prices shown.
              </p>
            </Card>

            <OrderReturnPanel
              orderNumber={order.order_number}
              email={customer.email}
              paymentStatus={order.payment_status}
              deliveredAt={deliveredAt}
              returnWindowDays={settingsQuery.data.return_window_days as number}
              items={items.map((i) => ({
                id: i.id,
                product_name: i.product_name,
                colour: i.colour,
                size: i.size,
                quantity: i.quantity,
              }))}
              existingReturns={(returnsQuery.data ?? []).map((r) => ({
                return_number: r.return_number as string,
                status: r.status as string,
              }))}
              contactEmail={contactEmail}
              cancellable={!order.cancelled_at && order.fulfilment_status === 'not_started'}
            />
          </div>
        </div>
      </div>
    </AccountShell>
  );
}

/** Stripe's shipping_details shape, which is what the webhook stores. */
function formatAddress(raw: Record<string, unknown>): string[] {
  const name = typeof raw.name === 'string' ? raw.name : null;
  const address = (raw.address ?? {}) as Record<string, unknown>;
  const parts = [
    name,
    address.line1,
    address.line2,
    address.city,
    address.postal_code,
    address.country,
  ];
  return parts.filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'var(--mc-bg-surface)',
        border: '1px solid var(--mc-border-default)',
        borderRadius: 4,
        padding: 20,
      }}
    >
      <h2
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '1.4px',
          textTransform: 'uppercase',
          color: 'var(--mc-text-muted)',
          margin: '0 0 14px',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
      <span style={{ color: 'var(--mc-text-muted)' }}>{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function SummaryRow({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 0',
        fontSize: big ? 17 : 15,
        fontWeight: big ? 600 : 400,
      }}
    >
      <span>{label}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

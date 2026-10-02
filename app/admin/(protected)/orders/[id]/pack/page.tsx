import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { WideOnly } from '@/components/admin/wide-only';
import { FULFILMENT_BADGE } from '@/components/admin/status-badge';
import { countryName, customerName, orderCountryCode } from '../../order-fields';
import { buildFulfilmentSteps } from '../fulfilment-steps';
import { PackWorkflow, type Pick } from './pack-workflow';

/**
 * A13 Pack (139:2295 Desktop / 139:2116 Tablet) — the packing bench screen,
 * and the only caller of advance_fulfilment. The departures from the design
 * are recorded in pack-workflow.tsx; this file is the data and the guards.
 *
 * WHY THE GUARDS ARE HERE AS WELL AS IN THE FUNCTION. advance_fulfilment
 * already refuses an unpaid order, a cancelled one, and any backwards step,
 * and that is what actually enforces it — this does not duplicate the state
 * machine, it only decides what to render. A picker who has walked to the
 * shelf, ticked four lines and then been told "order MC-10482 is already
 * packed" has wasted the walk; the point of checking first is that the
 * screen never offers work that cannot be completed.
 *
 * Only the pre-delivery steps are shown. buildFulfilmentSteps is shared with
 * A12 rather than re-derived here for the reason the fulfilment route gives
 * about the state machine: a second copy is a second thing to keep in sync,
 * and this would be the copy that drifts.
 */
export default async function PackOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerComponentClient();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id, order_number, email, total_pence, payment_status, fulfilment_status, delivery_method, delivery_address, customer_note, placed_at, cancelled_at',
    )
    .eq('id', id)
    .maybeSingle();
  // A query error and an unknown id both leave `order` null; only the second
  // is a 404 (CLAUDE.md's swallowed-error note).
  if (orderError) throw new Error(`Could not load the order: ${orderError.message}`);
  if (!order) notFound();

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('id, product_name, sku, colour, size, quantity')
    .eq('order_id', id);
  if (itemsError) throw new Error(`Could not load the order's items: ${itemsError.message}`);

  const blocked = packBlocker(order);
  if (blocked) {
    return (
      <WideOnly title={`Pack order ${order.order_number}`}>
        <div className="mc-admin-page">
          <div className="mc-admin-topbar">
            <div style={{ flex: '1 0 0', minWidth: 0 }}>
              <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
                Pack order {order.order_number}
              </h1>
            </div>
          </div>
          <div className="mc-admin-content">
            <section
              style={{
                background: 'var(--mc-bg-surface)',
                border: '1px solid var(--mc-border-default)',
                borderRadius: 'var(--mc-radius-md)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                maxWidth: 560,
              }}
            >
              <p style={{ fontSize: 15, lineHeight: '22px', margin: 0 }}>{blocked}</p>
              <p style={{ margin: 0 }}>
                <Link href={`/admin/orders/${order.id}`} style={{ fontSize: 15, fontWeight: 600 }}>
                  Back to order {order.order_number}
                </Link>
              </p>
            </section>
          </div>
        </div>
      </WideOnly>
    );
  }

  const picks: Pick[] = (items ?? []).map((item) => ({
    id: item.id,
    label: `${item.product_name} — ${item.colour} / ${item.size}`,
    sku: item.sku,
    quantity: item.quantity,
  }));

  const steps = buildFulfilmentSteps({
    paymentStatus: order.payment_status,
    fulfilmentStatus: order.fulfilment_status,
    placedAt: order.placed_at,
    cancelledAt: order.cancelled_at,
    fulfilment: null,
  }).slice(0, 4);

  const addr = (order.delivery_address ?? {}) as {
    name?: string;
    address?: Record<string, string | null | undefined>;
  };
  const line = addr.address ?? {};
  const addressLines = [
    addr.name,
    line.line1,
    line.line2,
    line.city,
    line.state,
    line.postal_code,
    countryName(orderCountryCode(order.delivery_address)),
  ].filter((v): v is string => Boolean(v && v !== '—'));

  return (
    <WideOnly title={`Pack order ${order.order_number}`}>
      <PackWorkflow
        orderId={order.id}
        orderNumber={order.order_number}
        customer={customerName(order.delivery_address, order.email)}
        itemCount={(items ?? []).reduce((n, i) => n + i.quantity, 0)}
        picks={picks}
        steps={steps}
        customerNote={order.customer_note}
        deliveryMethod={order.delivery_method}
        addressLines={addressLines}
        totalPence={order.total_pence}
        statusLabel={FULFILMENT_BADGE[order.fulfilment_status]?.label ?? order.fulfilment_status}
      />
    </WideOnly>
  );
}

/** The states in which there is no packing to do, in the order someone would
 * most want to hear about them. Returns null when the order can be packed. */
function packBlocker(order: {
  payment_status: string;
  fulfilment_status: string;
  cancelled_at: string | null;
}): string | null {
  if (order.cancelled_at || order.fulfilment_status === 'cancelled') {
    return 'This order was cancelled, so there is nothing to pack. Do not send it.';
  }
  if (order.payment_status !== 'paid') {
    return `This order has not been paid for yet (${order.payment_status}). Nothing should leave the building until Stripe confirms the payment, and advance_fulfilment refuses an unpaid order anyway.`;
  }
  if (order.fulfilment_status === 'packed') {
    return 'This order is already packed. The next step is adding a carrier and tracking number, which is what marks it shipped and emails the customer.';
  }
  if (order.fulfilment_status === 'shipped' || order.fulfilment_status === 'delivered') {
    return 'This order has already been dispatched. Packing it again would mean a second parcel for an order the customer has already been told is on its way.';
  }
  return null;
}

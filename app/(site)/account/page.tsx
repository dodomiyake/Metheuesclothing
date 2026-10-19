import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { requireCustomerPage } from '@/lib/account/require-customer';
import { AccountShell } from '@/components/site/account-shell';
import { formatPence } from '@/lib/money';
import { orderStatus } from '@/lib/orders/status';

export const metadata = { title: 'Your account — Metheues Clothings' };

type OrderRow = {
  id: string;
  order_number: string;
  placed_at: string;
  total_pence: number;
  payment_status: string;
  fulfilment_status: string;
  cancelled_at: string | null;
};

/**
 * 11 Account Overview — Figma 100:3082 (Desktop) and 100:2774 (Mobile),
 * both pulled. Tablet (100:2925) is the Desktop rail at the Tablet gutter.
 *
 * This is the first page of the account cluster, and it closes three dead
 * links that have been in the site footer since the chrome was built —
 * Overview, Saved Addresses and Account Details all pointed at /account,
 * which 404'd.
 *
 * EVERY FIGURE ON IT IS A REAL COUNT, which is the whole point of the four
 * tiles: orders placed, returns still open, addresses saved, and whether
 * the email is verified (auth.users.email_confirmed_at, read off the
 * session's own user — the one place it is visible without the service
 * role, which is why A19 needed a SECURITY DEFINER function for the same
 * column).
 *
 * TWO NARROWINGS on the latest-order line, both the same ones the homepage
 * made. The frame reads "4 T-shirts · £284.00 · Estimated delivery 12–16
 * September, tracked with DPD": nothing in this system computes a delivery
 * estimate, and no carrier is configured anywhere (A14's carrier field is
 * free text for exactly that reason). So the line carries the item count,
 * the total and the real delivery method, and the tracking link appears
 * only once a fulfilment row actually has one.
 *
 * "Track this order" goes to the order's own page rather than to a carrier:
 * tracking_url is per-fulfilment and may not exist, and 13 Order Detail is
 * where the timeline lives.
 */
export default async function AccountOverviewPage() {
  const customer = await requireCustomerPage('/account');
  const supabase = await createServerComponentClient();

  // Every query here is scoped by RLS to this customer (orders_own_read,
  // returns_own, addresses_own all match on auth.uid()), so none of them
  // carries a profile_id filter of its own: the policy is the filter, and
  // a second copy of it in the query would be the thing that drifts.
  const [ordersQuery, returnsQuery, addressesQuery] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, placed_at, total_pence, payment_status, fulfilment_status, cancelled_at')
      .order('placed_at', { ascending: false }),
    supabase.from('returns').select('id, status'),
    supabase.from('addresses').select('id'),
  ]);

  // A query error and an empty account both leave `data` null, and only the
  // second is "nothing here yet" (CLAUDE.md's swallowed-error note).
  if (ordersQuery.error) throw new Error(`Could not load your orders: ${ordersQuery.error.message}`);
  if (returnsQuery.error) throw new Error(`Could not load your returns: ${returnsQuery.error.message}`);
  if (addressesQuery.error) {
    throw new Error(`Could not load your addresses: ${addressesQuery.error.message}`);
  }

  const orders = (ordersQuery.data ?? []) as OrderRow[];
  const latest = orders[0] ?? null;
  const openReturns = (returnsQuery.data ?? []).filter(
    (r) => !['refunded', 'rejected', 'cancelled'].includes(r.status as string),
  ).length;

  let itemCount = 0;
  let deliveryMethod: string | null = null;
  let trackingNumber: string | null = null;
  if (latest) {
    const [itemsQuery, orderQuery, fulfilmentQuery] = await Promise.all([
      supabase.from('order_items').select('quantity').eq('order_id', latest.id),
      supabase.from('orders').select('delivery_method').eq('id', latest.id).maybeSingle(),
      supabase
        .from('fulfilments')
        .select('tracking_number, shipped_at')
        .eq('order_id', latest.id)
        .order('shipped_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (itemsQuery.error) throw new Error(`Could not load your order: ${itemsQuery.error.message}`);
    itemCount = (itemsQuery.data ?? []).reduce((n, i) => n + (i.quantity as number), 0);
    deliveryMethod = (orderQuery.data?.delivery_method as string | null) ?? null;
    trackingNumber = (fulfilmentQuery.data?.tracking_number as string | null) ?? null;
  }

  const memberSince = customer.memberSince
    ? new Date(customer.memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null;

  return (
    <AccountShell
      current="overview"
      eyebrow="Your account"
      title={customer.fullName?.trim() || 'Your account'}
      meta={
        <>
          {customer.email}
          {memberSince ? ` · Member since ${memberSince}` : ''}
        </>
      }
    >
      {latest ? (
        <div className="mc-account-card">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 0 0', minWidth: 180, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <p className="mc-account-eyebrow">Latest order</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>
                {latest.order_number} ·{' '}
                {new Date(latest.placed_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
            </div>
            <Status order={latest} />
          </div>

          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--mc-text-muted)' }}>
            {itemCount} {itemCount === 1 ? 'T-shirt' : 'T-shirts'} · {formatPence(latest.total_pence)}
            {deliveryMethod === 'next_day' ? ' · Next-day delivery' : ' · Tracked 48'}
            {trackingNumber ? ` · Tracking ${trackingNumber}` : ''}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link href={`/account/orders/${latest.order_number}`} className="mc-button-secondary">
              Track this order
            </Link>
            <Link href="/account/orders" className="mc-button-ghost">
              All orders
            </Link>
          </div>
        </div>
      ) : (
        <div className="mc-account-card">
          <p className="mc-account-eyebrow">Latest order</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--mc-text-muted)' }}>
            Nothing ordered yet. Anything you buy while signed in appears here with its status and
            its tracking.
          </p>
          <div>
            <Link href="/shop" className="mc-button-secondary">
              Shop T-shirts
            </Link>
          </div>
        </div>
      )}

      <div className="mc-account-tiles">
        <Tile
          href="/account/orders"
          title="Orders"
          count={orders.length === 0 ? 'None yet' : `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`}
          body="Every order, its status and its tracking."
        />
        <Tile
          href="/account/returns"
          title="Returns"
          count={openReturns === 0 ? 'None open' : `${openReturns} open`}
          body="Start a return from the order it belongs to."
        />
        <Tile
          href="/account/addresses"
          title="Saved addresses"
          count={
            (addressesQuery.data ?? []).length === 0
              ? 'None saved'
              : `${(addressesQuery.data ?? []).length} saved`
          }
          body="Speeds up checkout next time."
        />
        <Tile
          href="/account/details"
          title="Account details"
          count={customer.emailVerified ? 'Verified' : 'Email not verified'}
          body="Name, email and password."
        />
      </div>
    </AccountShell>
  );
}

function Tile({
  href,
  title,
  count,
  body,
}: {
  href: string;
  title: string;
  count: string;
  body: string;
}) {
  return (
    <Link href={href} className="mc-account-tile">
      <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--mc-text-primary)' }}>{title}</span>
      <span className="mc-account-eyebrow">{count}</span>
      <span style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--mc-text-muted)' }}>{body}</span>
    </Link>
  );
}

/** The dot is never the only signal — the word beside it carries the state. */
function Status({ order }: { order: OrderRow }) {
  const status = orderStatus(order);
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        aria-hidden
        style={{ width: 8, height: 8, borderRadius: '50%', background: status.colour, flexShrink: 0 }}
      />
      <span style={{ fontSize: 14, fontWeight: 500, color: status.colour }}>{status.label}</span>
    </span>
  );
}

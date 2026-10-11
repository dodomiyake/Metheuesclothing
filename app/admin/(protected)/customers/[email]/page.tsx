import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { requireStaffPage } from '@/lib/admin/require-staff';
import { formatPence } from '@/lib/money';
import { StatusBadge, orderBadge, returnBadge } from '@/components/admin/status-badge';
import { countryName } from '../../orders/order-fields';

/**
 * A20 Customer details — Figma 144:2696 (Desktop) / 144:2514 (Tablet).
 *
 * ONE breakpoint, like A12 and A13 and unlike A11: tablet stacks the main
 * column above the side column in the same order, and the split is at 1440
 * only. The side column is 340px there, A13's width rather than A12's 380
 * — measured off the frame, not inherited from the neighbour.
 *
 * It closes the "View customer" dead end A12 and A18 both had to omit.
 *
 * THE KEY IS THE EMAIL, not a uuid. A guest has no profile row, and the
 * whole argument of A19's footer is that a guest and an account holder
 * with the same address are one person whose orders group together. So
 * this page is reachable for an email that has never registered, and the
 * Profile card says so rather than 404ing on someone whose three orders
 * are listed right beside it.
 *
 * WHAT IS DRAWN AND NOT BUILT, each for its own reason:
 *
 *  - "Delivery updates by SMS" (144:2880). There is no SMS consent column
 *    anywhere, and nothing in this system sends a text. A row reading
 *    "Off" would be a consent record we do not keep, which is precisely
 *    what the card's own footer says not to do. The card says instead
 *    which preferences exist.
 *
 *  - "Erase this profile" (144:2882). Erasure is a real obligation and a
 *    real action, and it is not a button until it is written: UK GDPR
 *    plus six-year tax retention means nulling the person out of
 *    `profiles` while the orders stand, not a delete — `profiles.id`
 *    cascades to addresses and sets orders.profile_id null, so a careless
 *    delete would quietly turn their order history into guest orders.
 *    The card states what erasure has to do; the action goes in with the
 *    migration that implements it.
 *
 *  - The Returns card's "flag a customer" line is kept, because it is
 *    advice rather than a feature claim. Nothing flags anybody.
 *
 * What IS built rather than omitted is "Export their data", because unlike
 * A19's "Export customers" it has an obvious format (everything we hold
 * about one person) and a legal deadline attached to it.
 */
export default async function AdminCustomerPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  await requireStaffPage();

  const { email: raw } = await params;
  const email = decodeURIComponent(raw).trim().toLowerCase();

  const service = createServiceClient();
  const supabase = await createServerComponentClient();

  // The account facts come from the definer function (auth.users and
  // newsletter_subscribers are both unreachable from a staff session);
  // everything else is an ordinary staff read under RLS.
  const [accountQuery, ordersQuery] = await Promise.all([
    service.rpc('admin_customer_account', { p_email: email }),
    supabase
      .from('orders')
      .select('id, order_number, placed_at, total_pence, payment_status, fulfilment_status, delivery_address')
      .eq('email', email)
      .order('placed_at', { ascending: false }),
  ]);

  if (accountQuery.error) throw new Error(`Could not load the account: ${accountQuery.error.message}`);
  if (ordersQuery.error) throw new Error(`Could not load their orders: ${ordersQuery.error.message}`);

  const account = ((accountQuery.data ?? [])[0] ?? null) as Account | null;
  if (!account) throw new Error('Could not load the account.');

  const orders = (ordersQuery.data ?? []) as OrderRow[];
  const orderIds = orders.map((o) => o.id);

  const [returnsQuery, addressesQuery] = await Promise.all([
    orderIds.length
      ? supabase
          .from('returns')
          .select(
            'id, return_number, status, requested_at, order_id, orders!inner(order_number), return_items(quantity, order_items(unit_price_pence))',
          )
          .in('order_id', orderIds)
          .order('requested_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    account.profile_id
      ? supabase
          .from('addresses')
          .select('id, label, recipient, line1, line2, city, postcode, country_code, is_default')
          .eq('profile_id', account.profile_id)
          .order('is_default', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (returnsQuery.error) throw new Error(`Could not load their returns: ${returnsQuery.error.message}`);
  if (addressesQuery.error) {
    throw new Error(`Could not load their saved addresses: ${addressesQuery.error.message}`);
  }

  const returns = (returnsQuery.data ?? []) as unknown as ReturnRow[];
  const addresses = (addressesQuery.data ?? []) as AddressRow[];

  // Lifetime spend is defined the same way admin_customers() defines it:
  // orders that were actually paid for, at what was charged. Repeating the
  // rule here rather than passing the list's figure through keeps the two
  // screens honest about disagreeing if they ever do.
  const paid = orders.filter((o) =>
    ['paid', 'partially_refunded', 'refunded'].includes(o.payment_status),
  );
  const spent = paid.reduce((n, o) => n + o.total_pence, 0);
  const displayName = account.full_name || snapshotName(orders) || email;

  return (
    <div className="mc-admin-page">
      <div className="mc-admin-topbar">
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
            {displayName}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0, wordBreak: 'break-word' }}>
            {headline(email, paid.length, spent, account, orders)}
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 10px' }}>
          {/* A real action with somewhere to go: the staff member's own mail
              client, pre-addressed. Nothing in this app sends staff email. */}
          <a href={`mailto:${email}`} style={secondaryButton}>
            Email this customer
          </a>
          <a href={exportHref(email)} style={ghostButton}>
            Export their data
          </a>
        </div>
      </div>

      <div className="mc-admin-content">
        <div className="mc-admin-order-layout mc-admin-customer-layout">
          <div className="mc-admin-order-main">
            <Panel heading="Orders">
              {orders.length === 0 ? (
                <p style={mutedSmall}>
                  No orders against this address yet.
                </p>
              ) : (
                orders.map((o, i) => {
                  const badge = orderBadge(o.payment_status, o.fulfilment_status);
                  return (
                    <div
                      key={o.id}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 0',
                        borderTop: i === 0 ? undefined : '1px solid var(--mc-border-default)',
                      }}
                    >
                      <div style={{ flex: '1 0 0', minWidth: 140, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Link href={`/admin/orders/${o.id}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--mc-text-primary)' }}>
                          {o.order_number}
                        </Link>
                        <span style={{ fontSize: 12, color: 'var(--mc-text-muted)' }}>
                          Placed {formatDay(o.placed_at)}
                        </span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {formatPence(o.total_pence)}
                      </span>
                      <StatusBadge label={badge.label} tone={badge.tone} />
                    </div>
                  );
                })
              )}
            </Panel>

            <Panel heading="Returns">
              {returns.length === 0 ? (
                <p style={mutedSmall}>No returns from this customer.</p>
              ) : (
                returns.map((r, i) => {
                  const badge = returnBadge(r.status, r.requested_at);
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 0',
                        borderTop: i === 0 ? undefined : '1px solid var(--mc-border-default)',
                      }}
                    >
                      <div style={{ flex: '1 0 0', minWidth: 180, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Link href={`/admin/returns/${r.id}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--mc-text-primary)' }}>
                          {r.return_number}
                        </Link>
                        <span style={{ fontSize: 12, color: 'var(--mc-text-muted)' }}>
                          {r.orders?.order_number ?? '—'} · {unitCount(r)} item
                          {unitCount(r) === 1 ? '' : 's'} · {formatPence(valuePence(r))} · requested{' '}
                          {formatDay(r.requested_at)}
                        </span>
                      </div>
                      <StatusBadge label={badge.label} tone={badge.tone} />
                    </div>
                  );
                })
              )}
              <p style={mutedSmall}>{returnsSentence(returns.length, paid.length)}</p>
            </Panel>

            <Panel heading="Saved addresses">
              {!account.profile_id ? (
                <p style={mutedSmall}>
                  No account, so no saved addresses. Every order carries its own delivery
                  address, taken at the moment it was placed — open an order to see where it
                  went.
                </p>
              ) : addresses.length === 0 ? (
                <p style={mutedSmall}>
                  Nothing saved to the account yet. Checkout does not save an address back to
                  the account, so this fills only when they add one themselves.
                </p>
              ) : (
                addresses.map((a, i) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      paddingTop: i === 0 ? 0 : 11,
                      borderTop: i === 0 ? undefined : '1px solid var(--mc-border-default)',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mc-text-muted)' }}>
                      {a.is_default ? 'Default' : a.label?.trim() || 'Saved address'}
                    </span>
                    <span style={{ fontSize: 14, lineHeight: '20px' }}>{addressLine(a)}</span>
                  </div>
                ))
              )}
            </Panel>
          </div>

          <div className="mc-admin-order-side">
            <Panel heading="Profile">
              <Field label="Name" value={account.full_name || snapshotName(orders) || 'Not given'} />
              <Field label="Email" value={email} />
              <Field label="Phone" value={account.phone || 'Not given'} />
              <Field
                label={account.profile_id ? 'Member since' : 'First ordered'}
                value={memberSince(account, orders)}
              />
              {account.last_sign_in_at && (
                <Field label="Last signed in" value={formatFull(account.last_sign_in_at)} />
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px' }}>
                {account.profile_id ? (
                  <>
                    <StatusBadge
                      label={account.email_confirmed_at ? 'Email verified' : 'Email not verified'}
                      tone={account.email_confirmed_at ? 'success' : 'attention'}
                    />
                    <StatusBadge label="Account holder" tone="info" />
                  </>
                ) : (
                  <StatusBadge label="Guest — no account" tone="neutral" />
                )}
              </div>
            </Panel>

            <Panel heading="Contact preferences">
              {account.profile_id ? (
                <Field
                  label="Drop alerts by email"
                  value={
                    account.marketing_opt_in
                      ? `On${account.marketing_opt_in_at ? ` — since ${formatFull(account.marketing_opt_in_at)}` : ''}`
                      : 'Off'
                  }
                />
              ) : (
                <Field label="Drop alerts by email" value="No account, so no stored preference" />
              )}
              <Field label="Newsletter" value={newsletterValue(account)} />
              {/* The design's third row is "Delivery updates by SMS". See the
                  note at the top of this file: there is no such column and
                  nothing sends a text, and inventing an "Off" here would be
                  the consent record the paragraph below warns against. */}
              <p style={mutedSmall}>
                Set by the customer, not by you. Changing it from here would be a consent record
                you cannot evidence, so it is read-only. Email is the only channel this system
                has — nothing sends a text message, so there is no SMS preference to show.
              </p>
            </Panel>

            <Panel heading="Data requests" tint>
              <p style={mutedSmall}>
                Under UK GDPR you must answer a request for a copy or an erasure within one
                month. Order records stay for six years because tax law requires them — erasure
                removes the profile, not the sales history.
              </p>
              <a href={exportHref(email)} style={{ ...secondaryButton, width: '100%' }}>
                Export their data
              </a>
              <p style={mutedSmall}>
                Erasure is not a button yet, deliberately. Deleting the profile row cascades to
                their saved addresses and sets every order&rsquo;s owner to null — the orders
                survive, but silently become guest orders. Doing it properly means clearing the
                person out of the profile while the sales history stands, which is a migration
                nobody has written. Until then it is a database job, done once and recorded.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

type Account = {
  email: string;
  profile_id: string | null;
  full_name: string | null;
  phone: string | null;
  account: string;
  profile_created_at: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  marketing_opt_in: boolean | null;
  marketing_opt_in_at: string | null;
  newsletter_consent_at: string | null;
  newsletter_unsubscribed_at: string | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  placed_at: string;
  total_pence: number;
  payment_status: string;
  fulfilment_status: string;
  delivery_address: unknown;
};

type ReturnRow = {
  id: string;
  return_number: string;
  status: string;
  requested_at: string;
  order_id: string;
  orders: { order_number: string } | null;
  return_items: { quantity: number; order_items: { unit_price_pence: number } | null }[];
};

type AddressRow = {
  id: string;
  label: string | null;
  recipient: string;
  line1: string;
  line2: string | null;
  city: string;
  postcode: string;
  country_code: string;
  is_default: boolean;
};

function exportHref(email: string): string {
  return `/api/admin/customers/${encodeURIComponent(email)}/export`;
}

/** The name Stripe captured on the most recent order, for a customer with
 * no profile to carry one. */
function snapshotName(orders: OrderRow[]): string {
  for (const o of orders) {
    const a = o.delivery_address as { name?: unknown } | null;
    if (typeof a?.name === 'string' && a.name.trim()) return a.name.trim();
  }
  return '';
}

function headline(
  email: string,
  orderCount: number,
  spent: number,
  account: Account,
  orders: OrderRow[],
): string {
  const parts = [email];
  parts.push(`${orderCount} order${orderCount === 1 ? '' : 's'}`);
  parts.push(`${formatPence(spent)} lifetime`);
  parts.push(
    account.profile_id
      ? `member since ${memberSince(account, orders)}`
      : 'guest checkout — no account',
  );
  return parts.join(' · ');
}

function memberSince(account: Account, orders: OrderRow[]): string {
  if (account.profile_created_at) return formatFull(account.profile_created_at);
  const first = orders[orders.length - 1];
  return first ? formatFull(first.placed_at) : 'Unknown';
}

function newsletterValue(account: Account): string {
  if (account.newsletter_unsubscribed_at) {
    return `Unsubscribed ${formatFull(account.newsletter_unsubscribed_at)}`;
  }
  if (account.newsletter_consent_at) {
    return `Signed up ${formatFull(account.newsletter_consent_at)}`;
  }
  return 'Never signed up';
}

/** The design's "1 return from 3 orders. Nothing unusual — flag a customer
 * only when the pattern is clear, not on a single return." The advice is
 * kept; nothing in this system flags anybody, and the sentence does not
 * claim it does. */
function returnsSentence(returns: number, orders: number): string {
  if (orders === 0) return 'No orders yet, so nothing to return.';
  const stem = `${returns === 0 ? 'No returns' : `${returns} return${returns === 1 ? '' : 's'}`} from ${orders} order${orders === 1 ? '' : 's'}.`;
  if (returns === 0) return `${stem} Nothing to look at.`;
  if (returns < orders) {
    return `${stem} Nothing unusual — flag a customer only when the pattern is clear, not on a single return.`;
  }
  return `${stem} Worth a look at the reasons before the next order, but a pattern needs more than a handful.`;
}

function addressLine(a: AddressRow): string {
  return [a.recipient, a.line1, a.line2, a.city, a.postcode, countryName(a.country_code)]
    .filter((p) => p && String(p).trim())
    .join(', ');
}

function unitCount(r: ReturnRow): number {
  return (r.return_items ?? []).reduce((n, i) => n + i.quantity, 0);
}

function valuePence(r: ReturnRow): number {
  return (r.return_items ?? []).reduce(
    (n, i) => n + i.quantity * (i.order_items?.unit_price_pence ?? 0),
    0,
  );
}

/** "4 Sept" (144:2794). */
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "2 September 2026" (144:2862). */
function formatFull(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function Panel({
  heading,
  tint,
  children,
}: {
  heading?: string;
  tint?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        // The Data card sits on Ivory rather than white (144:2882) — the one
        // panel on this screen that is not a surface you read records off.
        background: tint ? 'var(--mc-bg-page)' : 'var(--mc-bg-surface)',
        border: '1px solid var(--mc-border-default)',
        borderRadius: 'var(--mc-radius-md)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxSizing: 'border-box',
      }}
    >
      {heading && (
        <>
          <h2
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              color: 'var(--mc-text-muted)',
              margin: 0,
            }}
          >
            {heading}
          </h2>
          <div aria-hidden style={{ height: 1, width: '100%', background: 'var(--mc-border-default)' }} />
        </>
      )}
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, color: 'var(--mc-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

const mutedSmall: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--mc-text-muted)',
  margin: 0,
};

const buttonBase: React.CSSProperties = {
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
  color: 'var(--mc-text-primary)',
  boxSizing: 'border-box',
};

/** Button/Secondary (9:8) and Button/Ghost (9:14). */
const secondaryButton: React.CSSProperties = {
  ...buttonBase,
  border: '1px solid var(--mc-border-strong)',
};
const ghostButton: React.CSSProperties = { ...buttonBase };

import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { requireStaffPage } from '@/lib/admin/require-staff';
import { formatPence } from '@/lib/money';
import { StatusBadge, ACCOUNT_BADGE } from '@/components/admin/status-badge';
import { countryName } from '../orders/order-fields';
import { CustomersToolbar } from './customers-toolbar';

const PAGE_SIZE = 25;

/**
 * A19 Customers — Figma 143:2465 (Desktop) / 143:2276 (Tablet).
 *
 * Structurally A11 and A17: the rail becomes a top bar at 1440 and the
 * seven-column table stays a table at 768 — confirmed by pulling the
 * tablet frame, which still draws all seven columns.
 *
 * THERE IS NO MOBILE FRAME, and this screen is not gated behind WideOnly
 * for the same reason A23 Audit log is not: wide-only.tsx exists for the
 * three EDITING screens, where a squashed form is worse than an honest
 * message, and the read-vs-write line it describes is read off which
 * frames exist rather than from any recorded decision. A19 is a read
 * screen — it is where you go when a customer emails asking what happened
 * to their order, which is exactly the moment you are away from a desk.
 * So below 768 it does what A11 and A17 do and renders one record per
 * person instead of a table. (That the file has no Mobile frame for a
 * read screen is the second counterexample to wide-only.tsx's rationale;
 * it is on the list to settle with the design owner.)
 *
 * WHERE THE DATA COMES FROM. "Customers" is not a table. A customer is a
 * `profiles` row or an email that ordered without one, and the five data
 * columns are an aggregate over `orders` grouped by email — none of which
 * PostgREST can express. admin_customers() (migration 016) does it in
 * Postgres, which is also the only way to reach auth.users.email_confirmed_at
 * for the ACCOUNT column. It is granted to service_role only, so this page
 * calls requireStaffPage() itself rather than trusting the layout above it.
 *
 * Two things in the design are not reproduced:
 *
 *  - "Export customers" (143:2546), for the same reason A11 omits "Export
 *    orders" and A07 omits "Export CSV": no route, no format, no decision
 *    about which columns. A20 DOES have an export, and the difference is
 *    the point — one person's data in a named format is a UK GDPR
 *    obligation with an obvious answer; a bulk customer CSV is a product
 *    decision nobody has made.
 *
 *  - The design's Germany row. Checkout restricts shipping to GB and IE
 *    (`allowed_countries` in app/api/checkout/route.ts), so an order from
 *    Germany cannot exist and the Country filter offers the two that can.
 */
type CustomerRow = {
  email: string;
  profile_id: string | null;
  full_name: string | null;
  account: string;
  order_count: number;
  spent_pence: number;
  last_order_at: string | null;
  country_code: string | null;
  total_count: number;
};

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaffPage();

  const params = await searchParams;
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  // ILIKE wildcards are stripped rather than escaped, the same way A11 and
  // A17 strip them: a '%' typed into a search box means a per cent sign,
  // not "match anything".
  const q = one('q').trim().replace(/[%_]/g, ' ').trim();
  const type = one('type');
  const country = one('country');
  const sort = one('sort') || 'recent';
  const page = Math.max(1, Number.parseInt(one('page') || '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = createServiceClient();

  const [listed, counted] = await Promise.all([
    supabase.rpc('admin_customers', {
      p_search: q || null,
      p_type: type || null,
      p_country: country || null,
      p_sort: sort,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    }),
    supabase.rpc('admin_customer_stats'),
  ]);

  // A query error and an empty shop both leave `data` null; only the second
  // is "no customers yet" (CLAUDE.md's swallowed-error note).
  if (listed.error) throw new Error(`Could not load customers: ${listed.error.message}`);
  if (counted.error) throw new Error(`Could not count customers: ${counted.error.message}`);

  const rows = (listed.data ?? []) as CustomerRow[];
  const total = rows[0]?.total_count ?? 0;
  const stats = ((counted.data ?? [])[0] ?? { people: 0, repeat_buyers: 0, guests: 0 }) as {
    people: number;
    repeat_buyers: number;
    guests: number;
  };

  const filtered = Boolean(q || type || country);

  return (
    <div className="mc-admin-page">
      <div className="mc-admin-topbar">
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
            Customers
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
            {subtitle(stats)}
          </p>
        </div>
      </div>

      <div className="mc-admin-content">
        <CustomersToolbar q={one('q').trim()} type={type} country={country} sort={sort} />

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
              {filtered
                ? 'Nobody matches these filters.'
                : 'No customers yet. Anyone who registers or places an order appears here.'}
            </p>
          ) : (
            <>
              {/* Tablet and desktop: the seven-column table (143:2567). */}
              <table className="mc-orders-table">
                <thead>
                  <tr>
                    <Th>Customer</Th>
                    <Th>Email</Th>
                    <Th>Orders</Th>
                    <Th>Spent</Th>
                    <Th>Last order</Th>
                    <Th>Country</Th>
                    <Th>Account</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const badge = ACCOUNT_BADGE[c.account] ?? { label: c.account, tone: 'neutral' as const };
                    return (
                      <tr key={c.email} style={{ borderTop: '1px solid var(--mc-border-default)' }}>
                        <Td>
                          <Link href={href(c.email)} style={nameLinkStyle}>
                            {c.full_name || 'No name given'}
                          </Link>
                        </Td>
                        <Td>{c.email}</Td>
                        <Td>{c.order_count}</Td>
                        <Td>{formatPence(c.spent_pence)}</Td>
                        <Td muted>{formatDay(c.last_order_at)}</Td>
                        <Td muted>{countryName(c.country_code ?? '')}</Td>
                        <Td>
                          <StatusBadge label={badge.label} tone={badge.tone} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Below 768: one record per person. No Mobile frame exists —
                  see the note at the top of this file. */}
              <div className="mc-orders-records">
                {rows.map((c) => {
                  const badge = ACCOUNT_BADGE[c.account] ?? { label: c.account, tone: 'neutral' as const };
                  return (
                    <div
                      key={c.email}
                      style={{
                        borderTop: '1px solid var(--mc-border-default)',
                        padding: '14px 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <Link href={href(c.email)} style={{ ...nameLinkStyle, fontSize: 15 }}>
                        {c.full_name || c.email}
                      </Link>
                      <p
                        style={{
                          fontSize: 13,
                          lineHeight: '19px',
                          color: 'var(--mc-text-muted)',
                          margin: 0,
                          wordBreak: 'break-word',
                        }}
                      >
                        {c.email} · {c.order_count} order{c.order_count === 1 ? '' : 's'} ·{' '}
                        {formatPence(c.spent_pence)} · Last order: {formatDay(c.last_order_at)} ·{' '}
                        {countryName(c.country_code ?? '')}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px' }}>
                        <StatusBadge label={badge.label} tone={badge.tone} />
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
            Guests have no account — they are matched by email so their orders still group
            together. They cannot sign in until they register with the same address. Orders and
            spend count what was actually paid for, so an abandoned checkout is not a customer
            with nothing in it.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <PageLink params={params} page={page - 1} disabled={page === 1}>
              Previous
            </PageLink>
            <PageLink params={params} page={page + 1} disabled={offset + rows.length >= total}>
              Next
            </PageLink>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The identity here is the email, not a uuid: a guest has no profile row to
 * key on, and the whole point of the screen is that both kinds of customer
 * are one person. admin_customers() lowercases it, so the URL is stable. */
function href(email: string): string {
  return `/admin/customers/${encodeURIComponent(email)}`;
}

/** "4 Sept" — the design's format (143:2581). */
function formatDay(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "318 people · 41 have ordered more than once" (143:2545), plus the guest
 * count, because the footer's whole subject is guests. */
function subtitle(stats: { people: number; repeat_buyers: number; guests: number }): string {
  if (stats.people === 0) return 'Nobody yet';
  const parts = [`${stats.people} ${stats.people === 1 ? 'person' : 'people'}`];
  parts.push(
    stats.repeat_buyers === 0
      ? 'nobody has ordered twice yet'
      : `${stats.repeat_buyers} ${stats.repeat_buyers === 1 ? 'has' : 'have'} ordered more than once`,
  );
  if (stats.guests > 0) parts.push(`${stats.guests} checked out as a guest`);
  return parts.join(' · ');
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
    // Ghost/Disabled (9:18). Not a link at all, so it cannot be tabbed to.
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
    <Link
      href={qs ? `/admin/customers?${qs}` : '/admin/customers'}
      style={{ ...base, color: 'var(--mc-text-primary)' }}
    >
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
        wordBreak: 'break-word',
      }}
    >
      {children}
    </td>
  );
}

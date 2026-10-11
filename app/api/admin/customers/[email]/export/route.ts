import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * A20's "Export their data" (144:2885) — a UK GDPR subject access request,
 * answered as a file.
 *
 * THIS IS THE ONE EXPORT IN THE ADMIN THAT GETS BUILT. A11's "Export
 * orders", A07's "Export CSV" and A19's "Export customers" are all omitted
 * for the same reason: no route, no format, and no decision about which
 * columns anyone wants. This one has none of those problems. The format is
 * "everything we hold about this person", the scope is one email, and
 * there is a one-month statutory deadline attached, which is what the card
 * it sits in says.
 *
 * JSON rather than CSV deliberately. The data is nested — orders have
 * items, returns have items — and a CSV would either flatten it (losing
 * which item belonged to which order) or be six files. A copy of someone's
 * data has to be complete and unambiguous before it is convenient.
 *
 * EVERY QUERY IS SCOPED TO THIS ONE EMAIL. The service client bypasses RLS,
 * so the scoping is the only thing keeping one customer's export from
 * being everybody's: orders by email, and everything below them by the ids
 * those orders returned.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ email: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { email: encoded } = await params;
  const email = decodeURIComponent(encoded).trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Not a valid email address.' }, { status: 400 });
  }

  const db = createServiceClient();

  const [accountQuery, ordersQuery] = await Promise.all([
    db.rpc('admin_customer_account', { p_email: email }),
    db
      .from('orders')
      .select(
        'id, order_number, placed_at, currency, subtotal_pence, delivery_pence, discount_pence, total_pence, payment_status, fulfilment_status, delivery_method, delivery_address, billing_address, customer_note, cancelled_at, cancel_reason, order_items(product_name, sku, colour, size, unit_price_pence, quantity, line_total_pence)',
      )
      .eq('email', email)
      .order('placed_at', { ascending: false }),
  ]);

  if (accountQuery.error) {
    return NextResponse.json({ error: accountQuery.error.message }, { status: 500 });
  }
  if (ordersQuery.error) {
    return NextResponse.json({ error: ordersQuery.error.message }, { status: 500 });
  }

  const account = (accountQuery.data ?? [])[0] ?? null;
  const orders = ordersQuery.data ?? [];
  const orderIds = orders.map((o) => o.id as string);
  const profileId = account?.profile_id as string | null | undefined;

  const [returnsQuery, addressesQuery, refundsQuery] = await Promise.all([
    orderIds.length
      ? db
          .from('returns')
          .select(
            'return_number, status, requested_at, received_at, decided_at, decision_reason, refund_pence, customer_note, return_items(quantity, reason, condition)',
          )
          .in('order_id', orderIds)
          .order('requested_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    profileId
      ? db
          .from('addresses')
          .select('label, recipient, line1, line2, city, postcode, country_code, phone, is_default, created_at')
          .eq('profile_id', profileId)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? db
          .from('refunds')
          .select('amount_pence, kind, reason, note, restocked, created_at')
          .in('order_id', orderIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const q of [returnsQuery, addressesQuery, refundsQuery]) {
    if (q.error) return NextResponse.json({ error: q.error.message }, { status: 500 });
  }

  const body = {
    // Said plainly in the file itself, because whoever receives it is
    // entitled to know what it does and does not contain.
    about:
      'Everything Metheues Clothings holds about this email address. Order records are kept for six years because tax law requires it; they are included here and are not removed by an erasure request.',
    exported_at: new Date().toISOString(),
    exported_by: session.userId,
    email,
    account: account
      ? {
          has_account: Boolean(account.profile_id),
          full_name: account.full_name,
          phone: account.phone,
          registered_at: account.profile_created_at,
          email_confirmed_at: account.email_confirmed_at,
          last_sign_in_at: account.last_sign_in_at,
          marketing_opt_in: account.marketing_opt_in,
          marketing_opt_in_at: account.marketing_opt_in_at,
          newsletter_consent_at: account.newsletter_consent_at,
          newsletter_unsubscribed_at: account.newsletter_unsubscribed_at,
        }
      : null,
    saved_addresses: addressesQuery.data ?? [],
    // `id` is dropped: it is our primary key, not their data.
    orders: orders.map(({ id: _id, ...rest }) => rest),
    returns: returnsQuery.data ?? [],
    refunds: refundsQuery.data ?? [],
  };

  const slug = email.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="metheues-data-${slug}.json"`,
      // A copy of someone's personal data is never a cacheable response.
      'cache-control': 'no-store',
    },
  });
}

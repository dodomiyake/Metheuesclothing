import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * Guest order lookup — §17 screen 28.
 *
 * This route exists because the alternative is worse. The tempting version is an
 * RLS policy on `orders` that matches on email, letting the browser query the
 * table directly. That policy would read "you may see orders whose email is the
 * one you asked about", which is not authentication: anyone who types a stranger's
 * address gets their order history. There is a note to this effect in
 * 002_rls.sql, and no such policy exists.
 *
 * So guests come through here instead, where two facts are required together and
 * the service role does the reading.
 */
const LookupRequest = z
  .object({
    order_number: z.string().trim().min(3).max(32),
    email: z.string().email(),
  })
  .strict();

// One message for every failure. Distinguishing "no such order" from "wrong
// email" would turn this endpoint into an order-number oracle: an attacker could
// walk MC-10001 upward and learn exactly which numbers are real.
const REJECTION = {
  error: 'We could not find an order with that number and email address.',
};

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, 'order-lookup', LIMITS.orderLookup);
  if (limited) return limited;

  const parsed = LookupRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(REJECTION, { status: 404 });

  const { order_number, email } = parsed.data;

  const db = createServiceClient();

  // Both conditions in one query. `email` is citext, so the comparison is
  // case-insensitive without lower() on either side.
  const { data: order } = await db
    .from('orders')
    .select(
      `id, order_number, placed_at, payment_status, fulfilment_status,
       subtotal_pence, delivery_pence, discount_pence, total_pence,
       delivery_method, delivery_address, cancelled_at`,
    )
    .eq('order_number', order_number)
    .eq('email', email)
    .maybeSingle();

  if (!order) return NextResponse.json(REJECTION, { status: 404 });

  const [{ data: items }, { data: fulfilments }] = await Promise.all([
    db
      .from('order_items')
      .select('id, product_name, colour, size, quantity, unit_price_pence, line_total_pence')
      .eq('order_id', order.id),
    db
      .from('fulfilments')
      .select('carrier, tracking_number, tracking_url, shipped_at, delivered_at')
      .eq('order_id', order.id)
      .order('shipped_at', { ascending: false }),
  ]);

  // The order's own UUID is not returned; the customer never needs it, and every
  // later action is keyed on the order number and email they have already proved
  // together here. The line-item ids ARE returned, because the returns form has
  // to name which lines are coming back. They are random UUIDs and useless on
  // their own: request_return() re-checks that each one belongs to the order the
  // number and email resolved to.
  const { id, ...safeOrder } = order;

  return NextResponse.json({
    order: safeOrder,
    items: items ?? [],
    fulfilments: fulfilments ?? [],
  });
}

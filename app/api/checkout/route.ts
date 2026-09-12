import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { getStripeClient } from '@/lib/stripe/client';

export const runtime = 'nodejs';

/**
 * §12: "Accept only variant ID and quantity during checkout creation."
 *
 * Note what is NOT in this schema: price, total, discount, product name. If the
 * browser sends them they are dropped by .strict(), because anything the client
 * can set, the client can lie about.
 */
const CheckoutRequest = z
  .object({
    items: z
      .array(
        z
          .object({
            variant_id: z.string().uuid(),
            quantity: z.number().int().min(1).max(10),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    email: z.string().email(),
    delivery_method: z.enum(['tracked_48', 'next_day']),
  })
  .strict();

export async function POST(req: NextRequest) {
  // Generous on purpose. Someone whose card is declined twice and who retries is
  // a customer, not an attacker; the thing being limited here is a script
  // creating hundreds of pending orders and Stripe sessions.
  const limited = await rateLimit(req, 'checkout', LIMITS.checkout);
  if (limited) return limited;

  const parsed = CheckoutRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { items, email, delivery_method } = parsed.data;

  const db = createServiceClient();

  // ---- price on the server, from the database ----
  const { data: priced, error: priceError } = await db.rpc('price_cart', {
    p_items: items,
  });
  if (priceError || !priced?.length) {
    // A variant that is inactive, unpublished or simply gone lands here.
    return NextResponse.json(
      { error: 'Some items are no longer available' },
      { status: 409 },
    );
  }

  // Every line the customer asked for must have come back. If one did not, the
  // basket changed under them — say so rather than quietly charging for less.
  if (priced.length !== items.length) {
    return NextResponse.json(
      { error: 'Some items are no longer available' },
      { status: 409 },
    );
  }

  const subtotal = priced.reduce(
    (sum: number, l: { line_total_pence: number }) => sum + l.line_total_pence,
    0,
  );

  // ---- delivery, also from the database ----
  const { data: settings } = await db
    .from('store_settings')
    .select('free_delivery_threshold_pence')
    .single();

  const threshold = settings?.free_delivery_threshold_pence ?? 15000;
  const deliveryPence =
    delivery_method === 'next_day'
      ? 695
      : subtotal >= threshold
        ? 0
        : 395;

  const total = subtotal + deliveryPence;

  // ---- create the order, pending ----
  // order_number comes from the sequence default (005), so two simultaneous
  // checkouts cannot collide on it.
  const { data: order, error: orderError } = await db
    .from('orders')
    .insert({
      email,
      subtotal_pence: subtotal,
      delivery_pence: deliveryPence,
      total_pence: total,
      payment_status: 'pending',
      delivery_method,
      delivery_address: {}, // collected at the Stripe step; filled by the webhook
    })
    .select('id, order_number')
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 500 });
  }

  await db.from('order_items').insert(
    priced.map((l: any) => ({
      order_id: order.id,
      variant_id: l.variant_id,
      product_name: l.product_name,
      sku: l.sku,
      colour: l.colour,
      size: l.size,
      unit_price_pence: l.unit_price_pence,
      quantity: l.quantity,
      line_total_pence: l.line_total_pence,
    })),
  );

  // ---- hand the server's numbers to Stripe ----
  const session = await getStripeClient().checkout.sessions.create({
    mode: 'payment',
    customer_email: email,
    line_items: priced.map((l: any) => ({
      quantity: l.quantity,
      price_data: {
        currency: 'gbp',
        unit_amount: l.unit_price_pence,
        product_data: {
          name: l.product_name,
          description: `${l.colour} / ${l.size}`,
        },
      },
    })),
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: deliveryPence, currency: 'gbp' },
          display_name:
            delivery_method === 'next_day' ? 'Next working day' : 'Tracked 48',
        },
      },
    ],
    shipping_address_collection: { allowed_countries: ['GB', 'IE'] },
    // The webhook needs to find this order. Stripe returns it untouched.
    metadata: { order_id: order.id, order_number: order.order_number },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/order/${order.order_number}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/bag`,
  });

  await db.from('payments').insert({
    order_id: order.id,
    stripe_checkout_session_id: session.id,
    amount_pence: total,
    status: 'pending',
  });

  return NextResponse.json({ url: session.url });
}

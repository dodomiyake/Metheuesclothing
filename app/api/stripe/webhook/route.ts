import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { sendTransactionalEmail } from '@/lib/email/send';
import { buildOrderConfirmationEmail } from '@/lib/email/templates/order-confirmation';
import { getStripeClient } from '@/lib/stripe/client';

// Node runtime, not edge: the Stripe SDK needs Node crypto to verify signatures.
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // ---------------------------------------------------------------------
  // 1. Verify the signature against the RAW body (§12).
  //
  // req.text() is the raw bytes as sent. Do NOT req.json() and re-stringify —
  // key order and whitespace change, the computed signature stops matching,
  // and you will spend an afternoon on it.
  // ---------------------------------------------------------------------
  const raw = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new NextResponse('No signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    // Never log the payload or the signature — §12.
    return new NextResponse('Invalid signature', { status: 400 });
  }

  const db = createServiceClient();

  // ---------------------------------------------------------------------
  // 2. Claim the event before doing any work (§12: process idempotently).
  //
  // stripe_event_id is the primary key. If this insert conflicts, another
  // delivery of the same event is already handled or in flight, so we return
  // 200 and do nothing. Stripe retries on non-2xx, so returning 200 here is
  // what stops the retry loop.
  // ---------------------------------------------------------------------
  const { error: claimError } = await db
    .from('webhook_events')
    .insert({ stripe_event_id: event.id, event_type: event.type });

  if (claimError) {
    // 23505 = unique_violation: already claimed. Anything else is a real fault,
    // and returning 500 asks Stripe to try again later.
    if ((claimError as any).code === '23505') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return new NextResponse('Could not record event', { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        if (!orderId) break;

        // Only mark paid if Stripe says it is paid. A completed session with
        // an unpaid status is possible for some payment methods.
        if (session.payment_status !== 'paid') break;

        const shipping = (session as any).collected_information?.shipping_details
          ?? (session as any).shipping_details;

        await db
          .from('orders')
          .update({
            payment_status: 'paid',
            fulfilment_status: 'processing',
            delivery_address: shipping ?? {},
          })
          .eq('id', orderId);

        await db
          .from('payments')
          .update({
            status: 'paid',
            stripe_payment_intent_id:
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id,
          })
          .eq('stripe_checkout_session_id', session.id);

        // Safe to call more than once — see 003_functions.sql. If this webhook
        // is somehow delivered twice past the guard above, stock still only
        // moves once.
        const { error: stockError } = await db.rpc('decrement_stock_for_order', {
          p_order_id: orderId,
        });

        if (stockError) {
          // An oversell. The customer has paid for something we do not have.
          // Do not fail the webhook — the payment is real and the order must
          // exist. Flag it loudly for a human instead.
          await db.from('audit_logs').insert({
            actor_label: 'System',
            action: 'oversell_detected',
            entity_type: 'order',
            entity_id: orderId,
            summary: `Paid order could not be stocked: ${stockError.message}`,
          });
        }

        // E3 order confirmation. Sent after the update above so it carries the
        // shipping address Stripe just gave us, and after the stock attempt so
        // an oversell (rare, logged above) does not also cost the customer
        // their confirmation email — the payment succeeded either way.
        const { data: confirmedOrder } = await db
          .from('orders')
          .select(
            'order_number, email, profile_id, currency, subtotal_pence, delivery_pence, total_pence, delivery_method, delivery_address',
          )
          .eq('id', orderId)
          .single();

        const { data: orderItems } = await db
          .from('order_items')
          .select('product_name, colour, size, quantity, unit_price_pence, line_total_pence')
          .eq('order_id', orderId);

        const { data: settings } = await db
          .from('store_settings')
          .select('return_window_days')
          .single();

        if (confirmedOrder && orderItems && settings) {
          const email = buildOrderConfirmationEmail(
            confirmedOrder,
            orderItems,
            settings.return_window_days,
          );
          await sendTransactionalEmail(db, {
            template: 'E3 order confirmation',
            to: confirmedOrder.email,
            subject: email.subject,
            html: email.html,
            text: email.text,
            entityType: 'order',
            entityId: orderId,
          });
        } else {
          // The order was just written and store_settings is seeded (008), so
          // any of these three coming back empty is a real fault, not a race.
          // Same principle as the oversell above: the payment succeeded, so
          // this is not a reason to fail the webhook — just to say so loudly.
          await db.from('audit_logs').insert({
            actor_label: 'System',
            action: 'email_delivery_failed',
            entity_type: 'order',
            entity_id: orderId,
            summary:
              'E3 order confirmation not sent: could not load order, items or store_settings.',
          });
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const intentId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (!intentId) break;

        await db
          .from('payments')
          .update({
            status: charge.amount_refunded === charge.amount
              ? 'refunded'
              : 'partially_refunded',
          })
          .eq('stripe_payment_intent_id', intentId);

        // Deliberately NOT restocking here. A refund and goods coming back are
        // different events, often days apart — see A16. Stock moves when a
        // human says the items are on the shelf.
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        if (orderId) {
          // The order was never paid, so no stock ever moved. Nothing to undo.
          await db
            .from('orders')
            .update({ payment_status: 'failed' })
            .eq('id', orderId)
            .eq('payment_status', 'pending');
        }
        break;
      }
    }

    await db
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id);

    return NextResponse.json({ received: true });
  } catch (err) {
    // IMPORTANT: release the claim before giving up.
    //
    // Without this, the sequence is: claim -> throw -> 500 -> Stripe retries ->
    // the claim row still exists -> the duplicate guard returns 200 -> the work
    // never happens, and nothing anywhere says so. A paid order would sit
    // unfulfilled with no stock movement and no error.
    //
    // Deleting the claim lets the retry redo the work properly. Two deliveries
    // racing after a failure is survivable: the order update is idempotent and
    // decrement_stock_for_order is guarded by its own unique index.
    await db.from('webhook_events').delete().eq('stripe_event_id', event.id);
    return new NextResponse('Handler failed', { status: 500 });
  }
}

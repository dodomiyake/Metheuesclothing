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

        const paidIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id;

        // THE CARD. payments.card_brand and .card_last4 have existed since
        // migration 001 and nothing ever wrote them, which narrowed five
        // screens at once: A12 omits its Payment method panel entirely, and
        // A15, A16, E5 and E8 all say "the card that paid" where the design
        // says "the Visa ending 4242". The details are on the CHARGE, not
        // the session, so the intent is retrieved with latest_charge
        // expanded — one API call on a path that already called Stripe to
        // create the session.
        //
        // Best-effort on purpose. A card brand is a nicety; the payment,
        // the order and the stock are not. A failure here must not cost the
        // customer their confirmation email or leave the webhook unclaimed,
        // so it is caught and the rest of the branch carries on.
        let card: { card_brand: string; card_last4: string } | null = null;
        // THE BILLING ADDRESS, from the same charge and for the same
        // reason. `orders.billing_address` has existed since 001 and
        // nothing ever wrote it, so A12 and 13 Order Detail both omit the
        // row the design draws. It is on the charge's billing_details
        // beside the card, which this call already fetches.
        let billing: Record<string, unknown> | null = null;
        if (paidIntentId) {
          try {
            const intent = await getStripeClient().paymentIntents.retrieve(paidIntentId, {
              expand: ['latest_charge'],
            });
            const charge = intent.latest_charge as Stripe.Charge | null;
            const details = charge?.payment_method_details?.card;
            if (details?.brand && details?.last4) {
              card = { card_brand: details.brand, card_last4: details.last4 };
            }

            // STORED IN THE SAME SHAPE AS delivery_address ({ name,
            // address }), so one helper renders either and A11's existing
            // jsonb paths keep working if anything ever filters on it.
            //
            // EXPECT IT TO BE SPARSE. The checkout session sets no
            // `billing_address_collection`, so Stripe defaults to 'auto'
            // and collects only what the card network requires — often a
            // country and postcode and nothing else. That is why this
            // writes only when a line1 or a postcode actually came back:
            // a row holding `{ name: null, address: { all nulls } }` would
            // make the admin render an empty "Billing address" panel and
            // look like a bug rather than like a customer who was never
            // asked.
            const b = charge?.billing_details;
            const hasAddress = Boolean(b?.address?.line1 || b?.address?.postal_code);
            if (b && hasAddress) {
              billing = {
                name: b.name ?? null,
                address: {
                  line1: b.address?.line1 ?? null,
                  line2: b.address?.line2 ?? null,
                  city: b.address?.city ?? null,
                  state: b.address?.state ?? null,
                  postal_code: b.address?.postal_code ?? null,
                  country: b.address?.country ?? null,
                },
              };
            }
          } catch {
            // Both left null. The order is paid either way.
          }
        }

        // A SECOND, SMALLER UPDATE rather than folding this into the one
        // above, deliberately: marking the order paid must not wait on a
        // Stripe call that can fail. The first update is the one that
        // matters and has already happened.
        if (billing) {
          await db.from('orders').update({ billing_address: billing }).eq('id', orderId);
        }

        await db
          .from('payments')
          .update({
            status: 'paid',
            stripe_payment_intent_id: paidIntentId,
            ...(card ?? {}),
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

        // The card, for a refund that arrived before (or without) a paid
        // event carrying it — the charge has the details in hand here.
        const refundCard = charge.payment_method_details?.card;

        const { data: paymentRow } = await db
          .from('payments')
          .select('order_id')
          .eq('stripe_payment_intent_id', intentId)
          .maybeSingle();

        await db
          .from('payments')
          .update({
            status: charge.amount_refunded === charge.amount
              ? 'refunded'
              : 'partially_refunded',
            ...(refundCard?.brand && refundCard?.last4
              ? { card_brand: refundCard.brand, card_last4: refundCard.last4 }
              : {}),
          })
          .eq('stripe_payment_intent_id', intentId);

        // Deliberately NOT restocking here. A refund and goods coming back are
        // different events, often days apart — see A16. Stock moves when a
        // human says the items are on the shelf.
        //
        // WHAT THIS BRANCH IS ACTUALLY FOR: a refund issued straight from the
        // Stripe DASHBOARD. One issued through our own admin (A15/A16) has
        // already written `refunds`, `orders.payment_status` and an audit row
        // before Stripe sent this event, so there is nothing left to do for
        // it. A dashboard refund used to move payments.status and nothing
        // else — no refunds row, orders.payment_status stuck on 'paid', and
        // no audit trail — which meant the admin showed an order as paid
        // that the customer had their money back for.
        //
        // The refunds are LISTED from the API rather than read off
        // charge.refunds: the embedded list is capped and may be absent on a
        // charge with many, and getting this wrong means missing a refund
        // rather than merely showing a stale one.
        const orderId = paymentRow?.order_id as string | undefined;
        if (orderId) {
          let stripeRefunds: Stripe.Refund[] = [];
          try {
            const list = await getStripeClient().refunds.list({ charge: charge.id, limit: 100 });
            stripeRefunds = list.data;
          } catch {
            stripeRefunds = [];
          }

          const { data: knownRows } = await db
            .from('refunds')
            .select('stripe_refund_id')
            .eq('order_id', orderId);
          const known = new Set(
            (knownRows ?? [])
              .map((r) => r.stripe_refund_id as string | null)
              .filter((id): id is string => Boolean(id)),
          );

          for (const refund of stripeRefunds) {
            if (known.has(refund.id)) continue;
            if (refund.status !== 'succeeded' && refund.status !== 'pending') continue;

            // record_refund does the whole job: the refunds row, both status
            // columns and the audit entry. restock stays false for the reason
            // above. Its own over-refund check and the unique index on
            // stripe_refund_id are what make calling it from here safe —
            // including on a redelivery of this event.
            const { error: recordError } = await db.rpc('record_refund', {
              p_order_id: orderId,
              p_amount_pence: refund.amount,
              p_reason: refund.reason
                ? `Refunded in Stripe (${refund.reason.replace(/_/g, ' ')})`
                : 'Refunded in Stripe',
              p_restock: false,
              p_note: 'Issued in the Stripe dashboard rather than in the admin.',
              p_stripe_refund_id: refund.id,
              p_actor: null,
              p_actor_label: 'Stripe',
            });

            if (recordError) {
              // Said out loud rather than swallowed: the money has left and
              // our record of it has not been written, which is the one
              // failure in this file a human has to know about. The webhook
              // still returns 200 — Stripe cannot fix this by retrying.
              await db.from('audit_logs').insert({
                actor_label: 'System',
                action: 'refund_not_recorded',
                entity_type: 'order',
                entity_id: orderId,
                summary: `Stripe refund ${refund.id} (GBP ${(refund.amount / 100).toFixed(
                  2,
                )}) could not be recorded: ${recordError.message}`,
              });
            }
          }
        }
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

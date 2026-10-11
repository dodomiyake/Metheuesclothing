import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { createServiceClient } from '@/lib/supabase/server';
import { getStripeClient } from '@/lib/stripe/client';
import { buildCancelledEmail } from '@/lib/email/templates/cancelled';
import { sendTransactionalEmail } from '@/lib/email/send';

export const runtime = 'nodejs';

const CancelRequest = z
  .object({
    reason: z.string().trim().min(1).max(200),
    note: z.string().trim().max(2000).optional().or(z.literal('')),
    /** Generated once when the dialog opens — see the idempotency note. */
    idempotency_key: z.string().trim().min(8).max(200),
  })
  .strict();

/**
 * A15 "Cancel this order".
 *
 * THE ORDER OF OPERATIONS IS THE OPPOSITE OF /ship's, on purpose.
 *
 * ship_order writes the database first because the parcel had already gone:
 * the irreversible thing had happened before the request started, so a
 * failure afterwards must not undo it. Here the irreversible thing is
 * Stripe's, and it has not happened yet. So Stripe goes first.
 *
 * Which failure that leaves is the whole argument. Database-first would mean
 * an order showing "Cancelled · refunded" while the money never moved —
 * staff see it as settled, stop looking, and the customer is simply out
 * £284 until they complain. Stripe-first means the money is genuinely back
 * and only our record is missing, which is recoverable: Stripe is the source
 * of truth, charge.refunded still fires and sets payments.status, and the
 * catch below writes an audit row naming the orphaned refund id so a human
 * has the thread to pull. Lose the record, never the money.
 *
 * IDEMPOTENCY IS NOT OPTIONAL HERE. A double-click on a refund button is two
 * refunds, and Stripe will happily issue both if asked twice with different
 * keys. The dialog generates one key when it opens and sends it with every
 * attempt, so a retry after a timeout returns Stripe's original refund rather
 * than making a second one. cancel_order's own "already cancelled" guard
 * catches the database half.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  const parsed = CancelRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { reason, note, idempotency_key } = parsed.data;

  const db = createServiceClient();

  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, order_number, email, total_pence, payment_status, fulfilment_status, cancelled_at')
    .eq('id', id)
    .maybeSingle();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'No such order.' }, { status: 404 });

  // cancel_order enforces all of this too. Checking first is not a second
  // copy of the state machine — it is what stops us refunding through Stripe
  // and only then discovering the database will refuse the cancellation.
  if (order.cancelled_at || order.fulfilment_status === 'cancelled') {
    return NextResponse.json({ error: `Order ${order.order_number} is already cancelled.` }, { status: 400 });
  }
  if (order.fulfilment_status === 'shipped' || order.fulfilment_status === 'delivered') {
    return NextResponse.json(
      {
        error: `Order ${order.order_number} has already been ${order.fulfilment_status}. The goods have left, so this needs a return and a refund rather than a cancellation.`,
      },
      { status: 400 },
    );
  }

  const { data: profile } = await db
    .from('profiles')
    .select('full_name, email')
    .eq('id', session.userId)
    .single();
  const actorLabel = profile?.full_name || profile?.email || 'Staff';

  let refundPence: number | null = null;
  let stripeRefundId: string | null = null;

  if (order.payment_status === 'paid') {
    const { data: payment } = await db
      .from('payments')
      .select('stripe_payment_intent_id, amount_pence')
      .eq('order_id', id)
      .maybeSingle();

    if (!payment?.stripe_payment_intent_id) {
      // Refusing beats cancelling without refunding. A cancelled order that
      // kept the customer's money is the one outcome nobody can defend, and
      // a paid order with no payment intent is a data problem for a human.
      return NextResponse.json(
        {
          error: `Order ${order.order_number} is marked paid but has no Stripe payment intent recorded, so the refund cannot be sent. Nothing has been changed — check this order in Stripe before cancelling it.`,
        },
        { status: 409 },
      );
    }

    try {
      const refund = await getStripeClient().refunds.create(
        { payment_intent: payment.stripe_payment_intent_id },
        { idempotencyKey: `cancel:${id}:${idempotency_key}` },
      );
      stripeRefundId = refund.id;
      refundPence = refund.amount;
    } catch (err) {
      // Nothing has been written, so this one is clean to fail.
      return NextResponse.json(
        {
          error: `Stripe refused the refund: ${
            err instanceof Error ? err.message : String(err)
          }. The order has not been cancelled.`,
        },
        { status: 502 },
      );
    }
  }

  const { data: restocked, error: rpcError } = await db.rpc('cancel_order', {
    p_order_id: id,
    p_reason: reason,
    p_amount_pence: refundPence,
    p_note: note || null,
    p_stripe_refund_id: stripeRefundId,
    p_actor: session.userId,
    p_actor_label: actorLabel,
  });

  if (rpcError) {
    if (stripeRefundId) {
      // The money is gone and we could not write it down. Say so loudly
      // rather than returning a generic 500 nobody can act on.
      await db.from('audit_logs').insert({
        actor_id: session.userId,
        actor_label: actorLabel,
        action: 'refund_not_recorded',
        entity_type: 'order',
        entity_id: id,
        summary: `Stripe refund ${stripeRefundId} was issued for order ${order.order_number} but cancel_order failed: ${rpcError.message}`,
      });
      return NextResponse.json(
        {
          error: `Stripe has refunded this order (${stripeRefundId}) but the cancellation could not be saved: ${rpcError.message}. The money is on its way back. Do not retry — the refund has already been sent. This has been written to the audit log.`,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  // E5. Best-effort, exactly as E3 and E4 are: the order is already
  // cancelled and the money already sent, so a failed email is §15's
  // "Email delivery failures", not a reason to pretend none of it happened.
  const email = buildCancelledEmail({ order_number: order.order_number }, refundPence);
  await sendTransactionalEmail(db, {
    template: 'E5',
    to: order.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    entityType: 'order',
    entityId: id,
  });

  return NextResponse.json({
    cancelled: true,
    refund_pence: refundPence,
    stripe_refund_id: stripeRefundId,
    lines_restocked: restocked,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { createServiceClient } from '@/lib/supabase/server';
import { getStripeClient } from '@/lib/stripe/client';
import { buildRefundedEmail } from '@/lib/email/templates/refunded';
import { sendTransactionalEmail } from '@/lib/email/send';

export const runtime = 'nodejs';

const RefundRequest = z
  .object({
    // Integer pence, like every other amount crossing this boundary. The
    // dialog parses the typed "284.00" with parsePounds so the browser never
    // sends a float — rule 1.
    amount_pence: z.number().int().positive().max(10_000_000),
    reason: z.string().trim().min(1).max(200),
    note: z.string().trim().max(2000).optional().or(z.literal('')),
    restock: z.boolean(),
    idempotency_key: z.string().trim().min(8).max(200),
  })
  .strict();

/**
 * A16 "Refund".
 *
 * Stripe first, database second, for the reason spelled out at length in the
 * cancel route: of the two failures available, an unrecorded refund is
 * recoverable and an unsent one that looks sent is not.
 *
 * WHAT MAKES THIS DIFFERENT FROM CANCEL is that the amount is chosen, so the
 * over-refund question is real. record_refund sums `refunds` for the order
 * and refuses anything that would take the total past what was paid — that
 * check only became possible with migration 012, because before it there was
 * nothing to sum. Stripe refuses an over-refund too, which is why this was
 * never a live bug; relying on the payment processor as your integrity
 * constraint is luck, not a control.
 *
 * RESTOCK IS A SEPARATE FLAG and stays off unless asked, which is A16's own
 * decision and a good one: "refunding money and restocking are separate
 * events and it is normal for one to happen days before the other."
 * Conflating them is how stock counts drift.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  const parsed = RefundRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { amount_pence, reason, note, restock, idempotency_key } = parsed.data;

  const db = createServiceClient();

  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, order_number, email, total_pence, payment_status')
    .eq('id', id)
    .maybeSingle();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'No such order.' }, { status: 404 });

  if (order.payment_status !== 'paid' && order.payment_status !== 'partially_refunded') {
    return NextResponse.json(
      { error: `Order ${order.order_number} is ${order.payment_status}, so there is nothing to refund.` },
      { status: 400 },
    );
  }

  // Checked here as well as in record_refund so we never send money we are
  // then going to refuse to record.
  const { data: existing, error: existingError } = await db
    .from('refunds')
    .select('amount_pence')
    .eq('order_id', id);
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  const already = (existing ?? []).reduce((n, r) => n + r.amount_pence, 0);
  if (already + amount_pence > order.total_pence) {
    return NextResponse.json(
      {
        error: `That is more than is left to refund. ${penceToText(already)} of ${penceToText(
          order.total_pence,
        )} has already gone back on order ${order.order_number}.`,
      },
      { status: 400 },
    );
  }

  const { data: payment } = await db
    .from('payments')
    .select('stripe_payment_intent_id')
    .eq('order_id', id)
    .maybeSingle();
  if (!payment?.stripe_payment_intent_id) {
    return NextResponse.json(
      {
        error: `Order ${order.order_number} has no Stripe payment intent recorded, so a refund cannot be sent from here. Nothing has been changed.`,
      },
      { status: 409 },
    );
  }

  const { data: profile } = await db
    .from('profiles')
    .select('full_name, email')
    .eq('id', session.userId)
    .single();
  const actorLabel = profile?.full_name || profile?.email || 'Staff';

  let stripeRefundId: string;
  let refundedPence: number;
  try {
    const refund = await getStripeClient().refunds.create(
      { payment_intent: payment.stripe_payment_intent_id, amount: amount_pence },
      { idempotencyKey: `refund:${id}:${idempotency_key}` },
    );
    stripeRefundId = refund.id;
    // Trust Stripe's number over ours: it is what actually left.
    refundedPence = refund.amount;
  } catch (err) {
    return NextResponse.json(
      {
        error: `Stripe refused the refund: ${
          err instanceof Error ? err.message : String(err)
        }. Nothing has been changed.`,
      },
      { status: 502 },
    );
  }

  const { error: rpcError } = await db.rpc('record_refund', {
    p_order_id: id,
    p_amount_pence: refundedPence,
    p_reason: reason,
    p_restock: restock,
    p_note: note || null,
    p_stripe_refund_id: stripeRefundId,
    p_actor: session.userId,
    p_actor_label: actorLabel,
  });

  if (rpcError) {
    await db.from('audit_logs').insert({
      actor_id: session.userId,
      actor_label: actorLabel,
      action: 'refund_not_recorded',
      entity_type: 'order',
      entity_id: id,
      summary: `Stripe refund ${stripeRefundId} of ${refundedPence}p was issued for order ${order.order_number} but record_refund failed: ${rpcError.message}`,
    });
    return NextResponse.json(
      {
        error: `Stripe has sent this refund (${stripeRefundId}) but it could not be saved: ${rpcError.message}. The money is on its way back. Do not retry — it has already been sent. This has been written to the audit log.`,
      },
      { status: 500 },
    );
  }

  // E8, best-effort like every other transactional send here.
  const email = buildRefundedEmail(
    { order_number: order.order_number },
    { amount_pence: refundedPence },
    already + refundedPence,
    order.total_pence,
  );
  await sendTransactionalEmail(db, {
    template: 'E8',
    to: order.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    entityType: 'order',
    entityId: id,
  });

  return NextResponse.json({
    refund_pence: refundedPence,
    stripe_refund_id: stripeRefundId,
    total_refunded_pence: already + refundedPence,
  });
}

/** Error messages only. formatPence uses Intl, which is fine on the server
 * but reads oddly inside a sentence a human will paste into Stripe. */
function penceToText(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

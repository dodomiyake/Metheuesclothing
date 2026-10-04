import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { createServiceClient } from '@/lib/supabase/server';
import { getStripeClient } from '@/lib/stripe/client';
import { buildReturnApprovedEmail } from '@/lib/email/templates/return-approved';
import { sendTransactionalEmail } from '@/lib/email/send';

export const runtime = 'nodejs';

const RefundReturnRequest = z
  .object({
    amount_pence: z.number().int().positive().max(10_000_000),
    reason: z.string().trim().min(1).max(200),
    note: z.string().trim().max(2000).optional().or(z.literal('')),
    idempotency_key: z.string().trim().min(8).max(200),
  })
  .strict();

/**
 * A18's Refund — the step that is deliberately separate from approving.
 *
 * Stripe first, database second, for the reason spelled out at length in
 * /api/admin/orders/[id]/cancel: of the two failures available, an
 * unrecorded refund is recoverable and one recorded but never sent is not.
 *
 * NO RESTOCK PARAMETER. refund_return passes p_restock => false into
 * record_refund on purpose: A18 already made that decision per item when the
 * return was approved, and running the whole-order restock here as well
 * would put the same goods back twice.
 *
 * E7 goes out from here rather than from the approve route, which is the
 * resolution of the naming knot in design-system-state.json — see the
 * template's own header.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  const parsed = RefundReturnRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { amount_pence, reason, note, idempotency_key } = parsed.data;

  const db = createServiceClient();

  const { data: ret, error: retError } = await db
    .from('returns')
    .select(
      'id, return_number, status, order_id, orders!inner(order_number, email, total_pence, delivery_pence), return_items(quantity, order_items(product_name, colour, size))',
    )
    .eq('id', id)
    .maybeSingle();
  if (retError) return NextResponse.json({ error: retError.message }, { status: 500 });
  if (!ret) return NextResponse.json({ error: 'No such return.' }, { status: 404 });

  const order = ret.orders as unknown as {
    order_number: string;
    email: string;
    total_pence: number;
    delivery_pence: number;
  };

  if (ret.status !== 'approved') {
    return NextResponse.json(
      {
        error: `Return ${ret.return_number} is ${ret.status}. Approve it before refunding — approving records the condition and puts the stock back, and this only moves money.`,
      },
      { status: 400 },
    );
  }

  // Checked here as well as inside record_refund so we never send money we
  // are then going to refuse to record.
  const { data: existing, error: existingError } = await db
    .from('refunds')
    .select('amount_pence')
    .eq('order_id', ret.order_id);
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  const already = (existing ?? []).reduce((n, r) => n + r.amount_pence, 0);
  if (already + amount_pence > order.total_pence) {
    return NextResponse.json(
      {
        error: `That is more than is left to refund on order ${order.order_number}. £${(
          already / 100
        ).toFixed(2)} of £${(order.total_pence / 100).toFixed(2)} has already gone back.`,
      },
      { status: 400 },
    );
  }

  const { data: payment } = await db
    .from('payments')
    .select('stripe_payment_intent_id')
    .eq('order_id', ret.order_id)
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
      { idempotencyKey: `return:${id}:${idempotency_key}` },
    );
    stripeRefundId = refund.id;
    // Stripe's number is what actually left.
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

  const { error: rpcError } = await db.rpc('refund_return', {
    p_return_id: id,
    p_amount_pence: refundedPence,
    p_reason: reason,
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
      entity_type: 'return',
      entity_id: id,
      summary: `Stripe refund ${stripeRefundId} of ${refundedPence}p was issued for return ${ret.return_number} but refund_return failed: ${rpcError.message}`,
    });
    return NextResponse.json(
      {
        error: `Stripe has sent this refund (${stripeRefundId}) but it could not be saved: ${rpcError.message}. The money is on its way back. Do not retry — it has already been sent. This has been written to the audit log.`,
      },
      { status: 500 },
    );
  }

  // E7, best-effort like every other transactional send here.
  const lines = (ret.return_items ?? []) as unknown as {
    quantity: number;
    order_items: { product_name: string; colour: string; size: string } | null;
  }[];
  const email = buildReturnApprovedEmail(
    { return_number: ret.return_number as string },
    { order_number: order.order_number },
    refundedPence,
    lines.map((l) => ({
      product_name: l.order_items?.product_name ?? 'Item',
      colour: l.order_items?.colour ?? '',
      size: l.order_items?.size ?? '',
      quantity: l.quantity,
    })),
    order.delivery_pence,
  );
  await sendTransactionalEmail(db, {
    template: 'E7',
    to: order.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    entityType: 'return',
    entityId: id,
  });

  return NextResponse.json({ refund_pence: refundedPence, stripe_refund_id: stripeRefundId });
}

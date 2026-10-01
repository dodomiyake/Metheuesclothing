import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { createServiceClient } from '@/lib/supabase/server';
import { buildDispatchedEmail } from '@/lib/email/templates/dispatched';
import { sendTransactionalEmail } from '@/lib/email/send';

export const runtime = 'nodejs';

const ShipRequest = z
  .object({
    carrier: z.string().trim().min(1).max(100),
    tracking_number: z.string().trim().min(1).max(100),
    tracking_url: z.string().trim().url().max(500).optional().or(z.literal('')),
  })
  .strict();

/**
 * A14 "Add tracking" — the one act that dispatches an order.
 *
 * ship_order (011) creates the fulfilment row and moves the order to
 * shipped in one statement, because the design is explicit that these are
 * the same act and splitting them allows an order marked shipped with
 * nothing to track.
 *
 * ORDER OF OPERATIONS MATTERS HERE, and it follows the Stripe webhook's
 * precedent exactly. The database write happens first and the email second,
 * and a failed email does NOT fail the request: the parcel is already with
 * the carrier and the fulfilment row is already written, so returning 500
 * would invite the person to click again and ship it twice. An unsent email
 * is §15's "Email delivery failures" — logged for a human to resend, not a
 * reason to undo a dispatch. sendTransactionalEmail never throws and writes
 * its own email_delivery_failed audit row.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  const parsed = ShipRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { carrier, tracking_number, tracking_url } = parsed.data;

  const db = createServiceClient();

  const { data: profile } = await db
    .from('profiles')
    .select('full_name, email')
    .eq('id', session.userId)
    .single();

  const { data: fulfilmentId, error } = await db.rpc('ship_order', {
    p_order_id: id,
    p_carrier: carrier,
    p_tracking_number: tracking_number,
    p_tracking_url: tracking_url || null,
    p_actor: session.userId,
    p_actor_label: profile?.full_name || profile?.email || 'Staff',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // E4. Everything below this point is best-effort by design — see above.
  const { data: order } = await db
    .from('orders')
    .select('order_number, email, delivery_method')
    .eq('id', id)
    .single();

  const { count: itemCount } = await db
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', id);

  if (order) {
    const email = buildDispatchedEmail(
      { order_number: order.order_number, delivery_method: order.delivery_method },
      { carrier, tracking_number, tracking_url: tracking_url || null },
      itemCount ?? 0,
    );
    await sendTransactionalEmail(db, {
      template: 'E4',
      to: order.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      entityType: 'order',
      entityId: id,
    });
  }

  return NextResponse.json({ fulfilment_id: fulfilmentId, fulfilment_status: 'shipped' });
}

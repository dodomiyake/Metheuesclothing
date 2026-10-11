import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { createServiceClient } from '@/lib/supabase/server';
import { buildReturnRejectedEmail } from '@/lib/email/templates/return-rejected';
import { sendTransactionalEmail } from '@/lib/email/send';

export const runtime = 'nodejs';

const DecideRequest = z
  .object({
    approve: z.boolean(),
    reason: z.string().trim().max(600).optional().or(z.literal('')),
    items: z
      .array(
        z
          .object({
            return_item_id: z.string().uuid(),
            condition: z.string().trim().max(300).optional().or(z.literal('')),
            restock: z.boolean(),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();

/**
 * A18's Approve and Reject.
 *
 * APPROVING SENDS NO EMAIL, and that is the design's decision rather than an
 * omission here: E7's canvas note says it "is only sent once the money has
 * actually left — never on approval alone". Rejecting does send one (E9),
 * because a rejection is the end of the story and the customer would
 * otherwise wait for a refund that is never coming.
 *
 * Unlike the refund routes, the database write comes FIRST here and the
 * email second — the same order as /ship, and for the same reason: nothing
 * irreversible happens outside our own database, so a failed send is §15's
 * "Email delivery failures", logged for a human to resend.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;
  const parsed = DecideRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { approve, reason, items } = parsed.data;

  const db = createServiceClient();

  const { data: profile } = await db
    .from('profiles')
    .select('full_name, email')
    .eq('id', session.userId)
    .single();

  const { data: status, error } = await db.rpc('decide_return', {
    p_return_id: id,
    p_approve: approve,
    p_reason: reason || null,
    p_items: items,
    p_actor: session.userId,
    p_actor_label: profile?.full_name || profile?.email || 'Staff',
  });

  // decide_return's messages name the return and say what would make the
  // call legal ("mark it received before approving"), which is what the
  // person on A18 needs to read.
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (!approve) {
    const { data: ret } = await db
      .from('returns')
      .select(
        'return_number, orders!inner(order_number, email), return_items(condition, order_items(product_name, colour, size))',
      )
      .eq('id', id)
      .single();

    if (ret) {
      const order = ret.orders as unknown as { order_number: string; email: string };
      const lines = (ret.return_items ?? []) as unknown as {
        condition: string | null;
        order_items: { product_name: string; colour: string; size: string } | null;
      }[];
      const email = buildReturnRejectedEmail(
        { return_number: ret.return_number as string },
        { order_number: order.order_number },
        reason || 'It does not meet the returns policy.',
        lines.map((l) => ({
          product_name: l.order_items?.product_name ?? 'Item',
          colour: l.order_items?.colour ?? '',
          size: l.order_items?.size ?? '',
          condition: l.condition,
        })),
      );
      await sendTransactionalEmail(db, {
        template: 'E9',
        to: order.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        entityType: 'return',
        entityId: id,
      });
    }
  }

  return NextResponse.json({ status });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/** §17 screen 30. Reasons are a closed set so the admin queue can group them. */
const RETURN_REASONS = [
  'too_small',
  'too_large',
  'not_as_described',
  'faulty',
  'changed_mind',
  'wrong_item_sent',
  'arrived_late',
] as const;

const ReturnRequest = z
  .object({
    order_number: z.string().trim().min(3).max(32),
    email: z.string().email(),
    items: z
      .array(
        z
          .object({
            order_item_id: z.string().uuid(),
            quantity: z.number().int().min(1).max(10),
            reason: z.enum(RETURN_REASONS),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    customer_note: z.string().trim().max(1000).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, 'returns', LIMITS.returns);
  if (limited) return limited;

  const parsed = ReturnRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { order_number, email, items, customer_note } = parsed.data;

  // The same line twice would pass each per-line quantity check separately and
  // together exceed what was bought. Caught here because it is a malformed
  // request rather than a rule about returns.
  const ids = items.map((i) => i.order_item_id);
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json(
      { error: 'Each item may only appear once' },
      { status: 400 },
    );
  }

  const db = createServiceClient();

  // Order number AND email, exactly as the lookup route does. This is the only
  // thing standing between a guessed order number and a stranger's return.
  const { data: order } = await db
    .from('orders')
    .select('id')
    .eq('order_number', order_number)
    .eq('email', email)
    .maybeSingle();

  if (!order) {
    return NextResponse.json(
      { error: 'We could not find an order with that number and email address.' },
      { status: 404 },
    );
  }

  // Everything else — paid, not cancelled, inside the window, lines belong to
  // this order, quantities still available — is checked inside request_return(),
  // in one transaction. See 007_request_return.sql.
  const { data, error } = await db.rpc('request_return', {
    p_order_id: order.id,
    p_items: items,
    p_customer_note: customer_note ?? null,
  });

  if (error) {
    // The function's RAISE messages are written to be read by a customer: they
    // name the order and the date the window closed rather than describing a
    // constraint. Anything unrecognised is not passed through.
    const known =
      /return window|not paid|cancelled|remain returnable|at least one item|does not belong/i.test(
        error.message,
      );
    return NextResponse.json(
      { error: known ? error.message : 'We could not create that return.' },
      { status: known ? 409 : 500 },
    );
  }

  const created = Array.isArray(data) ? data[0] : data;

  // Return labels are deferred (§ "Automatic return labels are deferred"), so
  // there is no label URL here yet. The customer gets the number and the
  // instructions; E6 is the email that carries the address to post it to.
  return NextResponse.json(
    { return_number: created.return_number, status: 'requested' },
    { status: 201 },
  );
}

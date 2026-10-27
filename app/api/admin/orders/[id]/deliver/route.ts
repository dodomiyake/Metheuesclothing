import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * A12's "Mark delivered" — the step that closed the end of fulfilment.
 *
 * NO SCREEN IN THE DESIGN FILE DRAWS THIS, and the reason it was built
 * anyway is the same one that put "Mark received" on A18: without it,
 * nothing downstream could ever happen. `fulfilments.delivered_at` is read
 * in nine places and was written by nothing, `advance_fulfilment` refuses
 * any transition but the packing steps, and `ship_order` stops at shipped —
 * so `delivered` was a value in the enum that no code path could produce.
 * Migration 024 has the full finding, including the half that cost a
 * customer something: the return window counts from delivered_at and was
 * silently falling back to shipped_at, so the clock started when the parcel
 * left rather than when it arrived.
 *
 * It sits beside /ship rather than inside /fulfilment for the reason
 * advance_fulfilment's own comment gives: that function is the packing
 * stepper, and shipping and delivery are facts about the parcel's real
 * history. Loosening its `p_to not in ('processing','packed')` guard to let
 * delivery through would also have loosened the guard that stops an order
 * being marked shipped with nothing to track.
 *
 * STAFF, NOT OWNER. Marking a parcel arrived is exactly the work A22's own
 * card describes as staff work — "orders, fulfilment and returns" — and it
 * is correctable by a person with the real date if somebody is hasty.
 *
 * `delivered_at` IS OPTIONAL AND MAY BE IN THE PAST, which is the one
 * parameter worth having. Staff hear about a delivery after it happens, and
 * since the returns window runs from this column, recording the date the
 * carrier gives rather than the date of the data entry is what gives the
 * customer the days they are owed. 024 refuses a future date and one
 * earlier than dispatch.
 *
 * THE DATE-ONLY FORM IS WHY THE STRING IS WIDENED HERE. A12 sends either
 * nothing (meaning "now") or a plain `YYYY-MM-DD` from a date input, which
 * is parsed to midnight UTC. Midnight on the dispatch day itself would be
 * before shipped_at and 024 would refuse it, which is correct rather than
 * awkward: a parcel dispatched at 14:00 did not arrive at 00:00 that
 * morning, and the person marking it knows which day it actually came.
 */
const DeliverRequest = z
  .object({
    delivered_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-27.')
      .optional(),
  })
  .strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id } = await params;

  // An empty body is the common case — "it arrived, now" — so a missing
  // body parses as {} rather than failing.
  const parsed = DeliverRequest.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? 'Invalid request' }, { status: 400 });
  }

  const db = createServiceClient();

  const { data, error } = await db.rpc('deliver_order', {
    p_order_id: id,
    p_actor: session.userId,
    // Midnight UTC on the named day. Null means now(), which the function
    // defaults to.
    p_delivered_at: parsed.data.delivered_on
      ? new Date(`${parsed.data.delivered_on}T00:00:00Z`).toISOString()
      : null,
  });

  if (error) {
    // 024's RAISE messages name the order and its state ("order MC-10482
    // has not been dispatched yet"), which is what the person on A12 needs
    // to read. Passing them through beats a generic 400 — the same call
    // /fulfilment makes.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ delivered_at: data });
}

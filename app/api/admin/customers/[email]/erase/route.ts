import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * A20's "Erase this profile" (144:2882) — the UK GDPR erasure right.
 *
 * It was omitted when A20 was built, and the card said why: doing it
 * properly means nulling the person out while the sales history stands,
 * which is a migration nobody had written. Migration 023 is that migration,
 * and its header carries the reasoning — including the finding that a
 * `delete from profiles` would not merely be wrong but would FAIL, because
 * audit_logs.actor_id is NO ACTION and audit_logs cannot be updated.
 *
 * ============================================================= OWNER ONLY
 * Every other write in the admin is gated on is_staff(), and that is right
 * for packing a parcel. This is the second route to need is_owner(), after
 * A22's settings, and the line is in the same place A22 draws it: staff do
 * orders, fulfilment and returns. Erasure cannot be undone by anybody —
 * not by us, not by Supabase, not by the customer asking us to put it back
 * — and it touches the sales ledger. A22's own staff card already says
 * "Staff — orders, fulfilment and returns, no settings"; this is neither.
 *
 * ================================================= THE AUTH IDENTITY FIRST
 * THIS IS THE OPPOSITE ORDER FROM /refund's, for the same kind of reasoning
 * rather than a different one. /refund writes Stripe first because an
 * unrecorded refund is recoverable and a recorded-but-unsent one is not.
 *
 * Here the two halves are the auth identity (GoTrue's auth.users, which
 * holds the address the customer signs in with) and everything in `public`.
 * Of the two half-failures available:
 *
 *   AUTH FIRST, database fails -> they can no longer sign in and their
 *   address is out of auth, but profiles and orders still hold it. A20 is
 *   keyed on the email, those rows still carry it, so staff look the person
 *   up exactly as before and press the button again. Recoverable.
 *
 *   DATABASE FIRST, auth fails -> the public data is anonymised but the
 *   customer can still sign in with the address GoTrue still holds, landing
 *   on an account whose orders have been scrubbed. Worse: A20 can no longer
 *   find them, because the lookup is by an email no row contains any more,
 *   so there is no screen left to retry from. Unrecoverable without SQL.
 *
 * So auth goes first. The tombstone is minted HERE for that reason — both
 * halves must end up holding the same address, or the account and its
 * orders are two different anonymous people. 023 validates its shape rather
 * than trusting it.
 *
 * WHY THE AUTH ADMIN API RATHER THAN SQL. `postgres` can write auth.users
 * directly (checked), and a migration that did so would be a migration
 * hand-editing identities, sessions and refresh tokens that GoTrue owns —
 * the way to get an account that is half deleted. updateUserById is the
 * sanctioned door. DELETING the auth user is not an option at all, for the
 * reason 023's header gives: the cascade into profiles is refused by
 * audit_logs. So the identity is anonymised and banned instead, which is
 * the same answer the database gives.
 *
 * ONE THING THE BAN DOES NOT DO: it does not expire an access token already
 * issued. A customer signed in at the moment of erasure keeps a working
 * token for up to its remaining hour, and sees their own scrubbed account
 * until it lapses. Revoking it needs their JWT, which we do not have.
 */
const EraseRequest = z
  .object({
    /** Typed into the dialog. Checked here too — the client is not the gate. */
    confirm_email: z.string().min(3),
    reason: z.string().min(1).max(200),
  })
  .strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ email: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  if (session.role !== 'owner') {
    return NextResponse.json(
      {
        error:
          'Only an owner can erase a customer. It cannot be undone and it touches the sales ledger.',
      },
      { status: 403 },
    );
  }

  const { email: encoded } = await params;
  const email = decodeURIComponent(encoded).trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Not a valid email address.' }, { status: 400 });
  }

  const parsed = EraseRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid request' },
      { status: 400 },
    );
  }

  if (parsed.data.confirm_email.trim().toLowerCase() !== email) {
    return NextResponse.json(
      { error: 'The address you typed does not match this customer.' },
      { status: 400 },
    );
  }

  const db = createServiceClient();
  const tombstone = `erased-${randomUUID()}@erased.invalid`;

  // The profile is looked up before anything is changed, because the auth
  // step needs its id and the id is gone from under that email afterwards.
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id, role')
    .eq('email', email)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: `Could not read the account: ${profileError.message}` },
      { status: 500 },
    );
  }

  // 023 refuses this too. Refusing here as well means the message arrives
  // before anything has been touched, rather than after the auth identity
  // of a member of staff has already been renamed.
  if (profile && profile.role !== 'customer') {
    return NextResponse.json(
      {
        error: `That account is ${profile.role}, not a customer. Change the role first, deliberately.`,
      },
      { status: 400 },
    );
  }

  if (profile) {
    const { error: authError } = await db.auth.admin.updateUserById(profile.id, {
      email: tombstone,
      email_confirm: true,
      user_metadata: {},
      // A hundred years. GoTrue has no "forever", and a ban that quietly
      // lapses is an account that quietly comes back.
      ban_duration: '876000h',
    });

    if (authError) {
      return NextResponse.json(
        {
          error: `Nothing has been erased. The sign-in identity could not be changed: ${authError.message}`,
        },
        { status: 500 },
      );
    }
  }

  const { data, error } = await db.rpc('erase_customer', {
    p_email: email,
    p_tombstone: tombstone,
    p_reason: parsed.data.reason.trim(),
    p_actor: session.userId,
  });

  if (error) {
    // The auth half has already happened and cannot be put back, so say so
    // rather than reporting a clean failure. The rows still carry the
    // address, so pressing the button again finishes the job.
    return NextResponse.json(
      {
        error: `${error.message} Their sign-in has already been disabled — the records still hold the address, so try again.`,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, report: data });
}

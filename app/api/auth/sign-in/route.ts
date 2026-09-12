import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';

const SignInRequest = z
  .object({
    email: z.string().email(),
    password: z.string().min(1).max(200),
  })
  .strict();

export async function POST(req: NextRequest) {
  const parsed = SignInRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  // Keyed by email as well as IP: this is a guessable credential check, the
  // same reasoning §"lookup failures are indistinguishable" already applies
  // to guest order lookup.
  const limited = await rateLimit(req, 'signIn', LIMITS.signIn, email.toLowerCase());
  if (limited) return limited;

  const supabase = await createRouteHandlerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // One message for "no such account" and "wrong password" — rule 6.
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}

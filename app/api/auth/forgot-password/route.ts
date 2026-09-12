import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';

const ForgotPasswordRequest = z.object({ email: z.string().email() }).strict();

// Same response whether the address has an account or not, and whether the
// request succeeded or was rate limited below — the design's own rule for
// this screen ("Reset says 'if an account exists'") is rule 6 applied to
// this flow: three different outcomes should not be three different replies.
const GENERIC_MESSAGE =
  'If an account exists for that address, we have sent a link to reset your password.';

export async function POST(req: NextRequest) {
  const parsed = ForgotPasswordRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { email } = parsed.data;

  const limited = await rateLimit(req, 'passwordReset', LIMITS.passwordReset, email.toLowerCase());
  if (limited) return NextResponse.json({ message: GENERIC_MESSAGE });

  const supabase = await createRouteHandlerClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });

  return NextResponse.json({ message: GENERIC_MESSAGE });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';

const ResendRequest = z.object({ email: z.string().email() }).strict();

// Distinct from POST /api/auth/register: an expired confirmation link
// (Figma 28, State 3) needs to send another one WITHOUT asking for the
// password and name again, which is what re-submitting the registration
// form would require. supabase.auth.resend() exists for exactly this.
export async function POST(req: NextRequest) {
  const parsed = ResendRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const limited = await rateLimit(req, 'register', LIMITS.register, parsed.data.email.toLowerCase());
  if (limited) return limited;

  const supabase = await createRouteHandlerClient();
  await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });

  // Same response regardless of outcome -- whether the address exists,
  // is already verified, or never had an account is not this endpoint's
  // to reveal, same reasoning as forgot-password's generic message.
  return NextResponse.json({ ok: true });
}

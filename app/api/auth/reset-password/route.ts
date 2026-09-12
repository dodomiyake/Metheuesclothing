import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';

const ResetPasswordRequest = z.object({ password: z.string().min(8).max(72) }).strict();

export async function POST(req: NextRequest) {
  const parsed = ResetPasswordRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const supabase = await createRouteHandlerClient();

  // updateUser only succeeds against an active session — the recovery
  // session /auth/callback established from the emailed link's code. No
  // rate limiting here: there is no secret being guessed, only "is there a
  // valid session", and getting one already went through forgot-password's
  // limiter and Supabase's own link expiry.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return NextResponse.json(
      { error: 'That reset link is no longer valid. Request a new one.' },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}

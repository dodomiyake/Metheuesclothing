import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';

const RegisterRequest = z
  .object({
    email: z.string().email(),
    password: z.string().min(10).max(72),
    full_name: z.string().trim().min(1).max(200).optional(),
    marketing_opt_in: z.boolean().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, 'register', LIMITS.register);
  if (limited) return limited;

  const parsed = RegisterRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { email, password, full_name, marketing_opt_in } = parsed.data;

  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });

  if (error) {
    // Supabase itself is deliberately vague here when email confirmations
    // are on: signing up an address that already has an account re-sends a
    // confirmation rather than erroring, so this branch is about what the
    // visitor just typed (a weak password, a malformed request), not about
    // who else has an account. Passing the message through is safe.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // 009's trigger creates the profiles row (id, email only) synchronously
  // inside the same transaction GoTrue's signUp commits before responding,
  // so it already exists here. full_name and marketing_opt_in are not part
  // of that trigger, so they land in one follow-up write with the service
  // role -- the route-handler client is still `anon` at this point (no
  // session until the email is confirmed), so it cannot write under RLS.
  if (data.user && (full_name || marketing_opt_in)) {
    const db = createServiceClient();
    await db
      .from('profiles')
      .update({
        ...(full_name ? { full_name } : {}),
        ...(marketing_opt_in
          ? { marketing_opt_in: true, marketing_opt_in_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', data.user.id);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

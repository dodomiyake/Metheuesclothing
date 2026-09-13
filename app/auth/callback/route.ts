import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';

/**
 * Where every emailed auth link lands — email confirmation and password
 * recovery both redirect here with a `code` param (PKCE), exchanged for a
 * session. `next` distinguishes the two: forgot-password sets it to
 * /reset-password, sign-up leaves it unset. Figma 27/28 (nodes 96:2731 /
 * 96:2806) each have a "link expired" state, which is why failure doesn't
 * just fall back to a generic sign-in error — it lands on the page that
 * actually explains what happened and offers to send a new one.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (code) {
    const supabase = await createRouteHandlerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next ?? '/verify-email?status=verified'}`);
    }
  }

  return NextResponse.redirect(
    `${origin}${next ? `${next}?error=expired` : '/verify-email?status=expired'}`,
  );
}

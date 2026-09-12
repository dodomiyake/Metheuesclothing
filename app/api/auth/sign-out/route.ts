import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';

export async function POST() {
  const supabase = await createRouteHandlerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}

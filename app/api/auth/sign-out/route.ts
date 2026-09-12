import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

export const runtime = 'nodejs';

// Redirects rather than returning JSON so a plain <form action="..."
// method="post"> works without any client-side JS -- the admin nav's sign
// out button relies on exactly that.
export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/', req.url));
}

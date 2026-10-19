import 'server-only';
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';

export type Customer = {
  id: string;
  email: string;
  fullName: string | null;
  memberSince: string | null;
  /** auth.users.email_confirmed_at, straight off the session's own user —
      the one place this is readable without the service role. */
  emailVerified: boolean;
};

/**
 * The front door for every /account page.
 *
 * `requireStaffPage()` is the admin's equivalent and this is deliberately
 * its twin rather than something cleverer. A LAYOUT IS NOT A SECURITY
 * BOUNDARY: one page that forgets to nest, or a future route group, and
 * the check is gone. Each page calls this itself.
 *
 * RLS is still the real lock — orders_own_read, addresses_own, returns_own
 * all match on auth.uid(), so a signed-in customer reading another
 * customer's order gets no rows no matter what this returns. What this
 * does is turn "no rows" into a sign-in page rather than an empty screen.
 *
 * `next` round-trips the path so signing in lands back where you were
 * rather than on the homepage.
 */
export async function requireCustomerPage(next: string): Promise<Customer> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at')
    .eq('id', user.id)
    .maybeSingle();

  // A query error must not read as "no profile". handle_new_user (migration
  // 009) creates the row on sign-up, so a missing one is a real fault worth
  // being loud about rather than a blank name.
  if (error) throw new Error(`Could not load your account: ${error.message}`);

  return {
    id: user.id,
    email: (profile?.email as string) ?? user.email ?? '',
    fullName: (profile?.full_name as string | null) ?? null,
    memberSince: (profile?.created_at as string | null) ?? user.created_at ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
  };
}

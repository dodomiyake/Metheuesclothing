import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { AdminRail } from './admin-rail';
import { AWAITING_FULFILMENT, AWAITING_RETURN } from '@/components/admin/status-badge';

/**
 * Gate for the whole /admin tree. A18/A01: staff never land on the customer
 * sign-in, and a signed-in customer never quietly sees admin data -- this is
 * the server-side half of that; profiles_self_read (002_rls.sql) is what
 * actually stops the query from returning another profile's role.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin/sign-in');
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single();

  // A query error must not read as "not staff" -- a real staff member
  // should see a loud failure during an outage, not a quiet demotion.
  if (error) throw new Error(`Could not load your profile: ${error.message}`);

  const isStaff = profile?.role === 'staff' || profile?.role === 'owner';

  if (!isStaff) {
    return (
      <main
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--mc-space-lg)',
          background: 'var(--mc-bg-page)',
          fontFamily: 'var(--mc-font-body)',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-section)' }}>
            You don&rsquo;t have access to the admin area
          </h1>
          <p style={{ color: 'var(--mc-text-muted)' }}>
            Signed in as {profile?.email ?? user.email}. If this should be a staff account,
            ask an owner to update your role.
          </p>
          <p>
            <Link href="/" style={{ color: 'var(--mc-text-primary)' }}>
              Back to the storefront
            </Link>
          </p>
        </div>
      </main>
    );
  }

  // The rail's Orders count is the real queue, not a decoration: the Admin
  // Nav Item component's description says counts are "for queues that need
  // attention", so it has to be a number someone can act on.
  const [{ count: awaiting }, { count: awaitingReturns }] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('fulfilment_status', AWAITING_FULFILMENT as unknown as string[]),
    supabase
      .from('returns')
      .select('id', { count: 'exact', head: true })
      .in('status', AWAITING_RETURN as unknown as string[]),
  ]);

  return (
    <div className="mc-admin-shell">
      <AdminRail
        name={profile?.full_name || profile?.email || 'Signed in'}
        email={profile?.email ?? ''}
        role={profile?.role ?? ''}
        awaitingOrders={awaiting ?? 0}
        awaitingReturns={awaitingReturns ?? 0}
      />
      <main className="mc-admin-main">{children}</main>
    </div>
  );
}

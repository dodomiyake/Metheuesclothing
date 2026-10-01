import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { AdminNavLink } from './admin-nav-link';
import { AWAITING_FULFILMENT } from '@/components/admin/status-badge';

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
  const { count: awaiting } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .in('fulfilment_status', AWAITING_FULFILMENT as unknown as string[]);

  return (
    <div className="mc-admin-shell">
      <nav className="mc-admin-rail">
        <div className="mc-admin-rail-top">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, letterSpacing: '2px' }}>
            <span style={{ fontFamily: 'var(--mc-font-display)', fontSize: 17, color: 'var(--mc-text-inverse)' }}>
              METHEUES
            </span>
            {/* The accent's sanctioned home on this screen (tokens.css):
                --mc-accent-on-dark, because the accent is a ground on pale
                surfaces and can only be type on ink or graphite. */}
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--mc-accent-on-dark)' }}>ADMIN</span>
          </div>
          <span className="mc-admin-rail-user" style={{ fontSize: 13, fontWeight: 500, color: 'var(--mc-text-muted-inverse)' }}>
            {profile?.full_name || profile?.email}
            {profile?.role ? ` · ${profile.role === 'owner' ? 'Owner' : 'Staff'}` : ''}
          </span>
        </div>

        {/* Only the sections that exist. The design draws ten nav items
            across four groups (Dashboard, Collections, Returns, Customers,
            Homepage content, Settings, Audit log); none of those pages are
            built, and a rail full of 404s is worse for staff than a short
            one. They go back in as each screen lands. */}
        <div className="mc-admin-nav">
          <AdminNavLink href="/admin/products">T-shirts</AdminNavLink>
          <AdminNavLink href="/admin/inventory">Inventory</AdminNavLink>
          <AdminNavLink href="/admin/orders" count={awaiting ?? 0}>
            Orders
          </AdminNavLink>
        </div>

        <div className="mc-admin-rail-foot">
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--mc-text-inverse)' }}>
            {profile?.full_name || profile?.email}
          </span>
          <span style={{ fontSize: 12, color: 'var(--mc-text-muted-inverse)' }}>
            {profile?.role === 'owner' ? 'Owner' : 'Staff'} · {profile?.email}
          </span>
          <form action="/api/auth/sign-out" method="post">
            <SignOutButton />
          </form>
        </div>
      </nav>
      <main className="mc-admin-main">{children}</main>
    </div>
  );
}

function SignOutButton() {
  return (
    <button
      type="submit"
      style={{
        padding: 0,
        minHeight: 44,
        background: 'none',
        border: 'none',
        color: 'var(--mc-accent-on-dark)',
        fontFamily: 'var(--mc-font-body)',
        fontSize: 13,
        fontWeight: 500,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      Sign out
    </button>
  );
}

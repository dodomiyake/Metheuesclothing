import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';

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

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--mc-font-body)',
      }}
    >
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <nav
          style={{
            width: 240,
            flexShrink: 0,
            background: 'var(--mc-bg-inverse)',
            color: 'var(--mc-text-inverse)',
            padding: 'var(--mc-space-lg) var(--mc-space-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--mc-space-2xs)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--mc-font-display)',
              fontSize: 15,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              padding: '0 var(--mc-space-sm) var(--mc-space-lg)',
            }}
          >
            Metheues Admin
          </div>
          <div
            style={{
              fontSize: 'var(--mc-type-tag)',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: 'var(--mc-text-muted-inverse)',
              padding: '0 var(--mc-space-sm)',
              marginTop: 'var(--mc-space-sm)',
            }}
          >
            Catalogue
          </div>
          <AdminNavLink href="/admin/products">T-shirts</AdminNavLink>
          <AdminNavLink href="/admin/inventory">Inventory</AdminNavLink>
          <div style={{ flex: 1 }} />
          <div
            style={{
              fontSize: 'var(--mc-type-caption)',
              color: 'var(--mc-text-muted-inverse)',
              padding: '0 var(--mc-space-sm) var(--mc-space-2xs)',
            }}
          >
            {profile?.full_name || profile?.email}
          </div>
          <form action="/api/auth/sign-out" method="post">
            <SignOutButton />
          </form>
        </nav>
        <main style={{ flex: 1, minWidth: 0, background: 'var(--mc-bg-page)', overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function AdminNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: 'var(--mc-space-xs) var(--mc-space-sm)',
        color: 'var(--mc-text-inverse)',
        fontSize: 'var(--mc-type-body)',
        textDecoration: 'none',
        minHeight: 44,
        lineHeight: '20px',
      }}
    >
      {children}
    </Link>
  );
}

function SignOutButton() {
  return (
    <button
      type="submit"
      style={{
        width: '100%',
        minHeight: 44,
        background: 'transparent',
        border: '1px solid var(--mc-stone-on-dark)',
        color: 'var(--mc-text-muted-inverse)',
        borderRadius: 'var(--mc-radius-sm)',
        fontFamily: 'var(--mc-font-body)',
        fontSize: 'var(--mc-type-body)',
        cursor: 'pointer',
      }}
    >
      Sign out
    </button>
  );
}

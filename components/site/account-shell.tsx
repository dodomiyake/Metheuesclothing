import Link from 'next/link';

export type AccountSection = 'overview' | 'orders' | 'returns' | 'addresses' | 'details';

const NAV: { key: AccountSection; label: string; href: string }[] = [
  { key: 'overview', label: 'Overview', href: '/account' },
  { key: 'orders', label: 'Orders', href: '/account/orders' },
  { key: 'returns', label: 'Returns', href: '/account/returns' },
  { key: 'addresses', label: 'Saved Addresses', href: '/account/addresses' },
  { key: 'details', label: 'Account Details', href: '/account/details' },
];

/**
 * The shell every account screen shares — 11 Account Overview (100:3082
 * Desktop, 100:2774 Mobile, both pulled). The ledger says 12, 13, 18 and 30
 * were all built by cloning this shell and replacing the content column,
 * so it is one component here for the same reason: the header, rail and
 * footer cannot drift between five screens if there is only one of them.
 *
 * THE NAV IS A RAIL AT 768 AND A WRAPPING CHIP ROW BELOW IT, which is what
 * the Account Nav Item component's own description asks for ("compose it
 * into a rail on tablet and desktop, a wrapping tab row on mobile") rather
 * than a 5x3 variant matrix. Current is marked three ways — a left rule, a
 * filled surface and a heavier weight — so it survives greyscale, and
 * aria-current says it a fourth way for anyone not looking at it.
 *
 * SIGN OUT MOVES BUT IS NOT DUPLICATED. The frames put it under the rail
 * on desktop and full width under the content on mobile; rendering it
 * twice and hiding one would put two identical buttons in the accessibility
 * tree, so the shell is a CSS grid with named areas and the button simply
 * lands in a different one. Same button, same form, one DOM node.
 */
export function AccountShell({
  current,
  eyebrow,
  title,
  meta,
  children,
}: {
  current: AccountSection;
  eyebrow: string;
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main style={{ fontFamily: 'var(--mc-font-body)' }}>
      <div className="mc-page-gutter mc-account-head">
        <p className="mc-account-eyebrow">{eyebrow}</p>
        <h1 className="mc-account-title">{title}</h1>
        {meta && <p className="mc-account-meta">{meta}</p>}
      </div>

      <div className="mc-page-gutter mc-account-body">
        <nav className="mc-account-nav" aria-label="Account">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={item.key === current ? 'page' : undefined}
              className="mc-account-nav-item"
              data-current={item.key === current ? 'true' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mc-account-content">{children}</div>

        <form action="/api/auth/sign-out" method="post" className="mc-account-signout">
          <button type="submit" className="mc-button-secondary" style={{ width: '100%' }}>
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}

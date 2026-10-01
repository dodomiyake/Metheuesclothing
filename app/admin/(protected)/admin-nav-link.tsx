'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Admin Nav Item — Figma component 125:37. Its own description: "Current is
 * a filled Deep Espresso surface plus a [accent] rule plus SemiBold. Count is
 * optional and is for queues that need attention — orders to pack, returns
 * to review."
 *
 * So current carries THREE signals, not one: the graphite fill, the 2px
 * accent rule, and the weight change — plus aria-current for anyone who sees
 * none of them. That is CLAUDE.md rule 8 (colour is never the only signal)
 * satisfied by the design itself rather than bolted on. An earlier version
 * here used a left border and a colour change with no fill, which is the
 * same idea at half strength.
 *
 * --mc-accent-on-dark, not --mc-accent: on this ink rail the accent is type,
 * and the pale-ground token is a FILL that cannot be used as type at all.
 *
 * The count is a real figure or nothing. A zero is not rendered: "Orders 0"
 * reads as a queue with nothing in it, which is exactly when the badge
 * should disappear rather than claim attention.
 *
 * Width is NOT set here. The component is drawn 212px wide, which is a
 * measurement that only means anything inside the 240px sidebar — applied in
 * the mobile drawer it left a strip of dead black beside every row. The
 * sidebar sets 212px itself in globals.css; the drawer goes full width.
 */
export function AdminNavLink({
  href,
  count,
  onNavigate,
  children,
}: {
  href: string;
  count?: number;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // A section is current when you are on it or anywhere beneath it, so
  // /admin/products/<id>/variants still lights "T-shirts".
  const current = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      onClick={onNavigate}
      className="mc-admin-nav-link"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 44,
        height: 44,
        padding: '11px 14px',
        borderRadius: 3,
        background: current ? 'var(--mc-graphite)' : 'transparent',
        color: current ? 'var(--mc-text-inverse)' : 'var(--mc-text-muted-inverse)',
        fontSize: 15,
        fontWeight: current ? 600 : 400,
        textDecoration: 'none',
        boxSizing: 'border-box',
      }}
    >
      {current && (
        <span
          aria-hidden
          style={{ width: 2, height: 20, background: 'var(--mc-accent-on-dark)', flexShrink: 0 }}
        />
      )}
      {children}
      <span style={{ flex: '1 0 0', minWidth: 0 }} />
      {count ? (
        <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{count}</span>
      ) : null}
    </Link>
  );
}

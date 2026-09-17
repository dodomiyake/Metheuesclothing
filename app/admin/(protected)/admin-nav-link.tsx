'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The admin rail's current-item treatment — the accent's other sanctioned
 * home (tokens.css). Extracted from layout.tsx, which is a Server
 * Component and so cannot read the pathname itself.
 *
 * The rail had no current-item indication at all before this: every link
 * looked identical whichever page you were on. The accent rule is the
 * design's answer to that, but it is deliberately not the only one —
 * CLAUDE.md rule 8 says colour is never the sole signal, so the current
 * item also carries a weight change and aria-current for anyone who
 * cannot see the rule at all.
 *
 * --mc-accent-on-dark, not --mc-accent: the pale-ground accent is only
 * 2.4:1 against this rail's ink.
 */
export function AdminNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  // A section is current when you are on it or anywhere beneath it, so
  // /admin/products/<id>/variants still lights "T-shirts".
  const current = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: 'var(--mc-space-xs) var(--mc-space-sm)',
        borderLeft: current ? '2px solid var(--mc-accent-on-dark)' : '2px solid transparent',
        color: current ? 'var(--mc-accent-on-dark)' : 'var(--mc-text-inverse)',
        fontWeight: current ? 600 : 400,
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

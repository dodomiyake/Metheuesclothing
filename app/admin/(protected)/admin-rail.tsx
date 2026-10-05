'use client';

import { useState } from 'react';
import { AdminNavLink } from './admin-nav-link';

/**
 * The admin rail: a 240px sidebar at 1440px+, a collapsed bar with a drawer
 * below it.
 *
 * THIS IS A DELIBERATE DEPARTURE from the Figma frames, and worth saying why.
 * A11/A12 Mobile (128:1422, 139:1379) draw the rail as a black block holding
 * ten 212px nav chips, which at 390px wrap one per row: a 494px-tall slab of
 * navigation above a screen whose entire height is 844. The design's own
 * mobile frame spends more than half the viewport on a nav nobody opened.
 * Our first build inherited the 212px width with only three items and still
 * gave each row a 146px strip of dead black to its right, because 212 is a
 * number that only means something inside a 240px sidebar.
 *
 * So below 1440 the nav collapses behind a toggle — the same pattern
 * components/site/header.tsx already uses on the storefront, for the same
 * reason — and drawer rows go full width instead of 212px. The admin bar
 * becomes ~60px instead of ~500px, which is what makes an admin screen
 * usable on a phone at all.
 *
 * The design IS followed on which breakpoint owns which shape: the rail
 * swaps at 1440, not 768, exactly as the frames show. Only the collapsed
 * form differs.
 */
export function AdminRail({
  name,
  email,
  role,
  awaitingOrders,
  awaitingReturns,
}: {
  name: string;
  email: string;
  role: string;
  awaitingOrders: number;
  awaitingReturns: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="mc-admin-rail" data-open={open}>
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
          {name}
          {role ? ` · ${role === 'owner' ? 'Owner' : 'Staff'}` : ''}
        </span>

        {/* Hidden at 1440+, where the nav is always visible in the sidebar. */}
        <button
          type="button"
          className="mc-admin-rail-toggle"
          aria-expanded={open}
          aria-controls="mc-admin-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {/* Only the sections that exist. The design draws ten items across four
          groups; the other seven have no pages, and a rail full of 404s is
          worse for staff than a short one. They go back as each screen
          lands. */}
      <div className="mc-admin-nav" id="mc-admin-nav">
        <AdminNavLink href="/admin" exact onNavigate={() => setOpen(false)}>
          Dashboard
        </AdminNavLink>
        <AdminNavLink href="/admin/products" onNavigate={() => setOpen(false)}>
          T-shirts
        </AdminNavLink>
        <AdminNavLink href="/admin/inventory" onNavigate={() => setOpen(false)}>
          Inventory
        </AdminNavLink>
        <AdminNavLink href="/admin/orders" count={awaitingOrders} onNavigate={() => setOpen(false)}>
          Orders
        </AdminNavLink>
        <AdminNavLink href="/admin/returns" count={awaitingReturns} onNavigate={() => setOpen(false)}>
          Returns
        </AdminNavLink>
      </div>

      <div className="mc-admin-rail-foot">
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--mc-text-inverse)' }}>{name}</span>
        <span style={{ fontSize: 12, color: 'var(--mc-text-muted-inverse)' }}>
          {role === 'owner' ? 'Owner' : 'Staff'} · {email}
        </span>
        <form action="/api/auth/sign-out" method="post">
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
        </form>
      </div>
    </nav>
  );
}

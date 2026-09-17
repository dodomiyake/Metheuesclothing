'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { SearchIcon, AccountIcon, BagIcon, MenuIcon, DismissIcon } from './icons';

/**
 * Site header — Figma component set 15:32, all three Breakpoint variants
 * pulled for real: Desktop 10:2 (1440x84), Tablet 15:2 (768x68), Mobile
 * 15:20 (390x60). The first build styled one desktop header with tokens and
 * let CSS hide things; that is not what the component does. Each breakpoint
 * has a DIFFERENT set of controls, and the layout depends on it:
 *
 *              left column (FILL)      wordmark (HUG)   right column (FILL)
 *   Mobile     Menu                    18px / 1.44      Bag
 *   Tablet     Menu + Search           22px / 1.76      Account + Bag
 *   Desktop    4 nav links, 12px       26px / 2.08      Search + Account + Bag
 *
 * The outer two columns are `flex: 1 0 0` and the wordmark hugs, which is
 * what centres it — Figma's own component description says so explicitly
 * ("do not set all three to FILL or the last nav item clips"), and the
 * design-system-state.json entry records a measured offset of 0 at all three
 * breakpoints. Our mobile header had three icons on the right against one
 * button on the left, so the wordmark sat visibly left of centre: the
 * "navbar isn't aligned" this rebuild is answering.
 *
 * Padding is per-breakpoint too (8 / 12x16 / 20x48) and is NOT the page
 * gutter — only the desktop value happens to match it. That is what makes
 * the header 60/68/84px tall rather than a constant 76.
 *
 * Search is inert at every breakpoint (§8.3 / screen 20's overlay isn't
 * built). "New Drop", "Collections" and "Our Story" point at routes that
 * don't exist yet — real links to real 404s rather than silently rewired.
 *
 * The one thing not in Figma: a mobile drawer. There is no nav-drawer node
 * in the file (it is still listed in design-system-state.json's
 * componentQueue), so the toggle pattern here is a reasonable default. It
 * carries the four nav links plus Account, because Mobile has no account
 * icon and losing the route entirely on a phone would be worse than a
 * disclosed deviation.
 */
export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="mc-header">
      {/* The toggle belongs INSIDE the lead column. As a sibling of it, its
          44px sat outside the `flex: 1 0 0` that is supposed to balance the
          utilities column, and the wordmark measured exactly 22px (half an
          icon) right of centre at both mobile and tablet. */}
      <div className="mc-header-lead">
        <button
          type="button"
          className="mc-nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <DismissIcon /> : <MenuIcon />}
        </button>

        {/* Tablet only: search sits beside the menu button, not in utilities. */}
        <button
          type="button"
          className="mc-icon-button mc-header-search-lead"
          title="Search (coming soon)"
          aria-label="Search"
        >
          <SearchIcon />
        </button>

        <nav className="mc-header-nav" data-open={open} style={navStyle(open)}>
          {NAV_LINKS.map(([label, href]) => (
            <Link key={label} href={href} style={navLinkStyle} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
          {/* Drawer only — Mobile has no account icon to reach this by. */}
          <Link href="/sign-in" className="mc-drawer-only" style={navLinkStyle} onClick={() => setOpen(false)}>
            Account
          </Link>
        </nav>
      </div>

      <Link href="/" className="mc-header-logo">
        METHEUES
      </Link>

      <div className="mc-header-icons">
        {/* Desktop only: utilities lead with search at 1440px+. */}
        <button
          type="button"
          className="mc-icon-button mc-header-search-util"
          title="Search (coming soon)"
          aria-label="Search"
        >
          <SearchIcon />
        </button>
        <Link href="/sign-in" className="mc-icon-button mc-header-account" aria-label="Account">
          <AccountIcon />
        </Link>
        <Link href="/bag" className="mc-icon-button" aria-label="Bag">
          <BagIcon />
        </Link>
      </div>
    </header>
  );
}

const NAV_LINKS: [string, string][] = [
  ['New Drop', '/drop'],
  ['Shop T-Shirts', '/shop'],
  ['Collections', '/collections'],
  ['Our Story', '/our-story'],
];

/** 12px SemiBold, 1.68 tracking, uppercase — Desktop nav (10:4–10:7). The
 * drawer reuses it so a phone reads the same wording in the same voice. */
function navStyle(open: boolean): CSSProperties {
  return {
    alignItems: open ? 'flex-start' : 'center',
    fontFamily: 'var(--mc-font-body)',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '1.68px',
    textTransform: 'uppercase',
  };
}

const navLinkStyle: CSSProperties = {
  color: 'var(--mc-text-primary)',
  textDecoration: 'none',
};

/* The 44px icon buttons are styled by .mc-icon-button in globals.css and
 * deliberately NOT inline. An inline `display` wins over every stylesheet
 * rule, including the media queries that decide which icons a breakpoint
 * has, so styling them here left all three showing on a phone -- the wordmark
 * measured 22px off centre with the fix supposedly in place. Same trap the
 * bag page's Continue-shopping button documents. */

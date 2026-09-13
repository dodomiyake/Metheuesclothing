'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { SearchIcon, AccountIcon, BagIcon, MenuIcon, DismissIcon } from './icons';

/**
 * Site header — Figma node 10:2 (desktop) / 15:32 (component), file
 * 9SzUlTWGVKOCkAULkbqOsr. "New Drop", "Collections" and "Our Story" point at
 * routes that don't exist yet (no drop/collections/about pages built) — real
 * links to real 404s, not silently rewired to /shop. Search has no overlay
 * built (§8.3 / screen 20) so it's inert rather than a link to nowhere.
 *
 * Below 768px the four nav links move behind the menu button instead of
 * staying inline (app/globals.css's .mc-header-nav rules) -- unwrapped, they
 * were wider than a phone screen and forced the whole page to overflow
 * horizontally. This toggle pattern is a reasonable default, not something
 * pulled from get_design_context: the same network block that leaves
 * icons.tsx's icons as stand-ins keeps this sandbox from confirming Figma
 * has a specific mobile nav screen to match instead.
 */
export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="mc-header mc-page-gutter" style={{ background: 'var(--mc-bg-page)', borderBottom: '1px solid var(--mc-border-default)', paddingTop: 'var(--mc-space-md)', paddingBottom: 'var(--mc-space-md)', fontFamily: 'var(--mc-font-body)' }}>
      <button
        type="button"
        className="mc-nav-toggle"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <DismissIcon /> : <MenuIcon />}
      </button>

      <nav
        className="mc-header-nav"
        data-open={open}
        style={{
          alignItems: open ? 'flex-start' : 'center',
          fontSize: 'var(--mc-type-tag)',
          fontWeight: 600,
          letterSpacing: '1.68px',
          textTransform: 'uppercase',
        }}
      >
        <Link href="/drop" style={navLinkStyle} onClick={() => setOpen(false)}>
          New Drop
        </Link>
        <Link href="/shop" style={navLinkStyle} onClick={() => setOpen(false)}>
          Shop T-Shirts
        </Link>
        <Link href="/collections" style={navLinkStyle} onClick={() => setOpen(false)}>
          Collections
        </Link>
        <Link href="/our-story" style={navLinkStyle} onClick={() => setOpen(false)}>
          Our Story
        </Link>
      </nav>

      <Link
        href="/"
        className="mc-header-logo"
        style={{
          fontFamily: 'var(--mc-font-display)',
          fontSize: 26,
          letterSpacing: '2.08px',
          color: 'var(--mc-text-primary)',
          textDecoration: 'none',
        }}
      >
        METHEUES
      </Link>

      <div className="mc-header-icons">
        <button
          type="button"
          title="Search (coming soon)"
          aria-label="Search"
          style={{ ...iconButtonStyle, cursor: 'default' }}
        >
          <SearchIcon />
        </button>
        <Link href="/sign-in" aria-label="Account" style={iconButtonStyle}>
          <AccountIcon />
        </Link>
        <Link href="/bag" aria-label="Bag" style={iconButtonStyle}>
          <BagIcon />
        </Link>
      </div>
    </header>
  );
}

const navLinkStyle: CSSProperties = {
  color: 'var(--mc-text-primary)',
  textDecoration: 'none',
};

const iconButtonStyle: CSSProperties = {
  width: 44,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--mc-text-primary)',
  background: 'none',
  border: 'none',
  textDecoration: 'none',
};

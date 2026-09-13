import Link from 'next/link';
import type { CSSProperties } from 'react';
import { SearchIcon, AccountIcon, BagIcon } from './icons';

/**
 * Site header — Figma node 10:2 (desktop) / 15:32 (component), file
 * 9SzUlTWGVKOCkAULkbqOsr. "New Drop", "Collections" and "Our Story" point at
 * routes that don't exist yet (no drop/collections/about pages built) — real
 * links to real 404s, not silently rewired to /shop. Search has no overlay
 * built (§8.3 / screen 20) so it's inert rather than a link to nowhere.
 */
export function Header() {
  return (
    <header
      style={{
        background: 'var(--mc-bg-page)',
        borderBottom: '1px solid var(--mc-border-default)',
        display: 'flex',
        alignItems: 'center',
        padding: 'var(--mc-space-md) var(--mc-gutter-desktop)',
        fontFamily: 'var(--mc-font-body)',
      }}
    >
      <nav
        style={{
          flex: 1,
          display: 'flex',
          gap: 'var(--mc-space-lg)',
          alignItems: 'center',
          fontSize: 'var(--mc-type-tag)',
          fontWeight: 600,
          letterSpacing: '1.68px',
          textTransform: 'uppercase',
        }}
      >
        <Link href="/drop" style={navLinkStyle}>
          New Drop
        </Link>
        <Link href="/shop" style={navLinkStyle}>
          Shop T-Shirts
        </Link>
        <Link href="/collections" style={navLinkStyle}>
          Collections
        </Link>
        <Link href="/our-story" style={navLinkStyle}>
          Our Story
        </Link>
      </nav>

      <Link
        href="/"
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

      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
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

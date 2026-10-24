'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { SearchIcon, AccountIcon, BagIcon, MenuIcon, DismissIcon } from './icons';
import { useCart } from '@/lib/bag/use-cart';

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
 * built). Every nav link now resolves: /collections and /our-story were
 * both 404s when this was first built, and "New Drop" goes to the shop
 * for the reason NAV_LINKS gives.
 *
 * The one thing not in Figma: a mobile drawer. There is no nav-drawer node
 * in the file (it is still listed in design-system-state.json's
 * componentQueue), so the toggle pattern here is a reasonable default. It
 * carries the four nav links plus Account, because Mobile has no account
 * icon and losing the route entirely on a phone would be worse than a
 * disclosed deviation.
 *
 * THE BAG COUNT IS A SECOND THING NOT IN FIGMA, and it is here because §8.6
 * requires it in so many words: "After adding a variant: ... Update the bag
 * count". The Header component set draws no badge in ANY of its three
 * variants — 15:29 is a bare 44px Icon / Bag — because the design's answer
 * to "did that work" is the side panel at 05G/H/I, which is unbuilt. Until
 * it is, adding to the bag changed nothing a customer could see outside the
 * product page's own inline line of text, which is the report this closes.
 *
 * Reported as a sum of quantities, matching what the bag page itself calls
 * the item count (page.tsx's totalQuantity) rather than counting lines —
 * two of one T-shirt is two items there and must be two here.
 */
export function Header() {
  const [open, setOpen] = useState(false);

  // useCart returns [] until its effect runs, so the server render and the
  // first client render agree on an empty bag and the count appears on the
  // same pass that reads localStorage. No hydration mismatch to suppress.
  const count = useCart().reduce((sum, line) => sum + line.quantity, 0);

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
          {/* /account, not /sign-in: the header has no idea whether
              anyone is signed in, and the account page redirects to
              sign-in with a `next` that comes straight back. One link for
              both states beats a link that is wrong for one of them. */}
          <Link href="/account" className="mc-drawer-only" style={navLinkStyle} onClick={() => setOpen(false)}>
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
        <Link href="/account" className="mc-icon-button mc-header-account" aria-label="Account">
          <AccountIcon />
        </Link>
        {/* The count lives in the accessible name rather than only in the
            badge, so it is not a visual-only signal (rule 8); the badge is
            hidden from the accessibility tree so the number is not read
            twice. --mc-accent is a FILL with --mc-accent-text on it, never
            accent as type on a pale ground. */}
        <Link
          href="/bag"
          className="mc-icon-button mc-bag-link"
          aria-label={count === 0 ? 'Bag, empty' : `Bag, ${count} ${count === 1 ? 'item' : 'items'}`}
        >
          <BagIcon />
          {count > 0 && (
            <span className="mc-bag-count" aria-hidden>
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

/**
 * The four the design draws (10:4–10:7). TWO OF THEM POINTED AT NOTHING:
 * /drop and /our-story have 404'd on every page since this chrome was
 * built, and they are half the primary navigation.
 *
 * "New Drop" now goes to the shop, which is where a new drop actually is —
 * `collections` has no rows, so there is no drop page to send anyone to,
 * and the homepage's own featured-drop link makes the same call.
 *
 * "Our Story" is screen 32 and now exists, so this link resolves. It spent
 * a long time pointing at a 404 rather than being quietly removed from the
 * nav the design specifies, which is what made it countable.
 */
const NAV_LINKS: [string, string][] = [
  ['New Drop', '/shop'],
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

'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

/**
 * Site footer — Figma set 21:66, all three Breakpoint variants pulled:
 * Desktop 21:4 (1440x428), Tablet 23:2 (768x394), Mobile 21:35 (390x589).
 *
 * The link columns are a grid, and its three column counts reproduce the
 * design's measured widths exactly rather than approximately:
 *   mobile   2 cols, 32px gap → (350 - 32) / 2  = 159  ✓ (21:40 is 159 wide)
 *   tablet   4 cols, 32px gap → (704 - 96) / 4  = 152  ✓ (23:7  is 152 wide)
 *   desktop  4 cols, 64px gap → (1344 - 192) / 4 = 288 ✓ (21:9  is 288 wide)
 * They were a single stacked column below 600px, which is the "2x2 on
 * mobile" design-system-state.json has recorded all along and nothing
 * implemented — a phone got one tall list instead of the designed pair.
 *
 * Supporting text on this dark ground uses the "on dark" muted token
 * specifically — the pale-ground muted fails AA here (design/tokens's own
 * contrast note; CLAUDE.md rule 8). Figma's component description still
 * names the WARM palette's #8A8178 for this; the September recolour replaced
 * it with #97A2AD and the description is simply stale.
 *
 * The newsletter FORM is a deliberate addition: 21:36 draws the heading and
 * the copy but no input, and cutting a working signup to match a screen that
 * doesn't depict one is the wrong direction — the same call the bag page
 * documents for its own email field. The heading and copy do take the
 * design's sizes (24/32/36 and 14).
 */
export function Footer({
  newsletterTitle,
  newsletterBody,
}: {
  /** §9.7's newsletter slot, from homepage_sections via the site layout.
   * The footer is on every page, so this is the one content slot that is
   * not only the homepage's. Undefined means nothing stored, and the
   * shipped wording stands. */
  newsletterTitle?: string;
  newsletterBody?: string;
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sent'>('idle');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    // Same outcome whether it was a new signup, a repeat, or rate limited --
    // there is nothing here worth telling a subscriber apart over.
    setStatus('sent');
  }

  return (
    <footer className="mc-footer mc-page-gutter">
      <div>
        <p className="mc-footer-heading">{newsletterTitle ?? 'Join the Metheues Frequency'}</p>
        <p style={{ fontSize: 14, lineHeight: 1.45, margin: '0 0 16px' }}>
          {newsletterBody ??
            'Drop alerts and first access. No more than twice a month, and you can leave any time.'}
        </p>
        {status === 'sent' ? (
          <p style={{ fontSize: 14, color: 'var(--mc-text-inverse)' }}>You&rsquo;re on the list.</p>
        ) : (
          <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              style={{
                flex: 1,
                minHeight: 44,
                padding: '10px 12px',
                background: 'var(--mc-ink)',
                border: '1px solid var(--mc-slate-on-dark)',
                borderRadius: 'var(--mc-radius-sm)',
                color: 'var(--mc-chalk)',
                fontFamily: 'var(--mc-font-body)',
                fontSize: 14,
              }}
            />
            <button
              type="submit"
              style={{
                minHeight: 44,
                padding: '0 20px',
                background: 'var(--mc-accent)',
                color: 'var(--mc-accent-text)',
                border: 'none',
                borderRadius: 'var(--mc-radius-sm)',
                fontFamily: 'var(--mc-font-body)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Sign up
            </button>
          </form>
        )}
      </div>

      <div className="mc-footer-columns">
        <FooterColumn
          title="Shop"
          links={[
            ['T-Shirts Collection', '/shop'],
            ['Limited Editions', '/collections'],
            ['Best Sellers', '/shop'],
          ]}
        />
        <FooterColumn
          title="Help"
          links={[
            ['Contact', '/contact'],
            ['Delivery', '/delivery'],
            ['Returns and Exchanges', '/track-order'],
            ['Size Guide', '/size-guide'],
          ]}
        />
        <FooterColumn
          title="Account"
          links={[
            // Three of these pointed at /account, which 404'd until the
            // account cluster existed; "Orders and Returns" went to the
            // GUEST lookup, which is the wrong door for someone with an
            // account. /account sends anyone not signed in to sign-in and
            // straight back here.
            ['Overview', '/account'],
            ['Orders and Returns', '/account/orders'],
            ['Saved Addresses', '/account/addresses'],
            ['Account Details', '/account/details'],
          ]}
        />
        <FooterColumn
          title="Legal"
          links={[
            ['Privacy Policy', '/privacy'],
            ['Terms and Conditions', '/terms'],
            ['Cookie Policy', '/privacy'],
            ['Accessibility', '/accessibility'],
          ]}
        />
      </div>

      <div className="mc-footer-bottom" style={{ fontSize: 12 }}>
        <p style={{ margin: 0 }}>
          © 2026 Metheues Clothings · Registered in England and Wales · VAT registered
        </p>
        <p style={{ margin: 0, whiteSpace: 'nowrap' }}>UK / GBP (£)</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="mc-footer-column">
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '1.32px',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        {title}
      </p>
      {links.map(([label, href]) => (
        <Link
          key={label}
          href={href}
          style={{ color: 'var(--mc-text-inverse)', fontSize: 14, textDecoration: 'none' }}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

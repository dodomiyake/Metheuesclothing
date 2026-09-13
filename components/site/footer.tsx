'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

/** Figma node 21:66. Supporting text on this dark ground uses the "on dark"
 * muted token specifically -- the pale-ground Stone fails AA here at 3.2:1
 * (design/tokens/tokens.css's own contrast note; CLAUDE.md rule 8). */
export function Footer() {
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
    <footer
      style={{
        background: 'var(--mc-bg-inverse)',
        color: 'var(--mc-text-muted-inverse)',
        padding: '64px var(--mc-gutter-desktop) 32px',
        fontFamily: 'var(--mc-font-body)',
      }}
    >
      <div style={{ marginBottom: 48 }}>
        <p style={{ fontFamily: 'var(--mc-font-display)', fontSize: 32, color: 'var(--mc-text-inverse)', margin: '0 0 12px' }}>
          Join the Metheues Frequency
        </p>
        <p style={{ fontSize: 15, margin: '0 0 16px' }}>
          Drop alerts and first access. No more than twice a month, and you can leave any time.
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
                background: 'var(--mc-black)',
                border: '1px solid var(--mc-stone-on-dark)',
                borderRadius: 'var(--mc-radius-sm)',
                color: 'var(--mc-cream)',
                fontFamily: 'var(--mc-font-body)',
                fontSize: 14,
              }}
            />
            <button
              type="submit"
              style={{
                minHeight: 44,
                padding: '0 20px',
                background: 'var(--mc-cream)',
                color: 'var(--mc-black)',
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

      <div style={{ display: 'flex', gap: 64, marginBottom: 48, flexWrap: 'wrap' }}>
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
            ['Overview', '/account'],
            ['Orders and Returns', '/track-order'],
            ['Saved Addresses', '/account'],
            ['Account Details', '/account'],
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

      <div style={{ display: 'flex', gap: 24, fontSize: 12, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24 }}>
        <p style={{ flex: 1, margin: 0 }}>
          © 2026 Metheues Clothings · Registered in England and Wales · VAT registered
        </p>
        <p style={{ margin: 0, whiteSpace: 'nowrap' }}>UK / GBP (£)</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div style={{ flex: '1 0 0', minWidth: 140 }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '1.32px',
          textTransform: 'uppercase',
          margin: '0 0 12px',
        }}
      >
        {title}
      </p>
      {links.map(([label, href]) => (
        <Link
          key={label}
          href={href}
          style={{ display: 'block', color: 'var(--mc-text-inverse)', fontSize: 14, textDecoration: 'none', marginBottom: 12 }}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

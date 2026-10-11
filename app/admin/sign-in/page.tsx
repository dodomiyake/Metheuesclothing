'use client';

import { useState, type FormEvent, type CSSProperties } from 'react';
import Link from 'next/link';

/**
 * A01 — Admin Sign In. All three breakpoints pulled: Desktop 126:54, Tablet
 * 126:32, Mobile 126:10. They are the same screen at two card widths (350
 * on mobile, 420 from 768 up) — nothing else differs, which is why there is
 * one layout here and a single CSS width step rather than three.
 *
 * The earlier version of this page was styled with tokens but never matched
 * against the design, and got the central idea backwards: it put a GRAPHITE
 * card with dark inputs and a white button on the black ground. The design
 * is a WHITE card — ink on white, bordered inputs, black primary button —
 * floating on black. The black is the page, not the card. That inversion is
 * the whole reason this screen reads as "staff entrance" rather than as a
 * dark-mode variant of the storefront sign-in.
 *
 * Behaviour is unchanged and deliberate: this posts to the same
 * /api/auth/sign-in the storefront uses, because it is the same Supabase
 * session either way. Signing in here does not by itself grant admin
 * access — the role check happens in app/admin/(protected)/layout.tsx.
 *
 * THE SMALL PRINT IS NOT THE DESIGN'S, and that is on purpose. The design
 * draws: "Sessions expire after 12 hours of inactivity. Every sign-in,
 * refund and stock adjustment is written to the audit log with your name
 * against it." Checked against the code, all four claims are false today:
 *   - No 12-hour expiry exists anywhere. Session lifetime is a Supabase Auth
 *     dashboard setting, not application code; lib/supabase/middleware.ts
 *     refreshes the cookie on every request, so if anything a session
 *     survives as long as someone keeps clicking. Flag it for the owner the
 *     same way the E1/E2 "send email" hook is flagged — it is configurable,
 *     just not by us.
 *   - Sign-ins are not written to audit_logs.
 *   - There is no admin refund action yet (it is what E8 is waiting on), so
 *     no refund can be logged.
 *   - Stock adjustments go to inventory_adjustments via adjust_stock()
 *     (migration 010), not to audit_logs.
 * What IS true is narrower still, and the first version of this page got it
 * wrong too. It said "Returns and payment events are written to an audit
 * log" — but every audit_logs insert in the codebase is a FAILURE path:
 * oversell_detected in the Stripe webhook, and email_delivery_failed in the
 * webhook, the returns route and lib/email/send.ts. A payment that succeeds
 * writes nothing. A return that succeeds writes nothing. So the only honest
 * claim is the one about the log's integrity, not its coverage: audit_logs
 * is append-only, enforced by the forbid_audit_mutation triggers in 003/004,
 * so neither staff nor the owner can edit or delete what IS in it.
 *
 * That gap is worth closing — an audit log that only records failures is not
 * really an audit log — but it is a decision about what should be audited,
 * not something to guess at mid-screen. Flag it for the owner alongside the
 * session-expiry setting.
 *
 * Password helper says 10, not the design's 12: app/api/auth/register
 * enforces z.string().min(10) and there is no admin-specific rule. Printing
 * a minimum the app does not apply is the same class of mistake.
 */
export default function AdminSignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Something went wrong. Please try again.');
      return;
    }
    window.location.href = '/admin/products';
  }

  return (
    <main className="mc-admin-signin">
      <form onSubmit={onSubmit} className="mc-admin-signin-card">
        {/* Brand — 126:12. Tracking is 2px on both lines. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span
            style={{
              fontFamily: 'var(--mc-font-display)',
              fontSize: 24,
              letterSpacing: '2px',
              color: 'var(--mc-text-primary)',
            }}
          >
            METHEUES
          </span>
          <span
            style={{
              fontFamily: 'var(--mc-font-body)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '2px',
              color: 'var(--mc-text-muted)',
            }}
          >
            ADMIN
          </span>
        </div>

        {/* 126:15 — Manrope SemiBold 20, NOT the display serif. */}
        <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, color: 'var(--mc-text-primary)', margin: 0 }}>
          Sign in
        </h1>

        <p style={{ fontFamily: 'var(--mc-font-body)', fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)', margin: 0 }}>
          This area is for store staff. Customer accounts sign in on the storefront.
        </p>

        {error && (
          <p
            role="alert"
            style={{
              fontFamily: 'var(--mc-font-body)',
              fontSize: 14,
              lineHeight: '21px',
              color: 'var(--mc-status-error)',
              fontWeight: 600,
              margin: 0,
            }}
          >
            {error}
          </p>
        )}

        <label style={fieldStyle}>
          <span style={labelStyle}>Email address</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          <span style={helperStyle}>At least 10 characters. Use a password manager.</span>
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            minHeight: 44,
            padding: '14px 24px',
            background: 'var(--mc-action-primary-bg)',
            color: 'var(--mc-action-primary-text)',
            border: 'none',
            borderRadius: 'var(--mc-radius-sm)',
            fontFamily: 'var(--mc-font-body)',
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '0.32px',
            lineHeight: 1.2,
            cursor: loading ? 'progress' : 'pointer',
            boxSizing: 'border-box',
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        {/* A real route, not a dead link: admin and storefront share the same
            Supabase auth, so the storefront's reset flow resets this too.
            The underline is kept although 126:29 draws this as plain text —
            it is ink on white, the same colour as the body copy above it, so
            the underline is the ONLY thing marking it as a link. Dropping it
            to match the screen would leave no affordance at all, which is the
            colour-is-never-the-only-signal rule pointing the other way. */}
        <Link
          href="/forgot-password"
          style={{
            fontFamily: 'var(--mc-font-body)',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--mc-text-primary)',
          }}
        >
          Forgotten your password?
        </Link>

        <div style={{ height: 1, width: '100%', background: 'var(--mc-border-default)' }} />

        <p style={{ fontFamily: 'var(--mc-font-body)', fontSize: 12, lineHeight: '18px', color: 'var(--mc-text-muted)', margin: 0 }}>
          Anything written to the audit log cannot be edited or deleted afterwards —
          not by you, and not by the owner.
        </p>
      </form>
    </main>
  );
}

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: '100%',
};

/** Form Field's label — always visible, never placeholder-only (§13, and the
 * component's own description in Figma says so). */
const labelStyle: CSSProperties = {
  fontFamily: 'var(--mc-font-body)',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '1.44px',
  textTransform: 'uppercase',
  color: 'var(--mc-text-primary)',
};

/* The one place this departs from the Figma Form Field: its Input binds
 * Semantic/border/default, which is #E0E0E0 — 1.26:1 against the white card,
 * so the field's only boundary would be invisible. CLAUDE.md rule 8 and WCAG
 * 1.4.11 both want 3:1 on a control edge, so this uses --mc-border-control
 * (4.54:1 on white), exactly as the storefront's form-styles.ts does. The
 * Figma component has been rebound to match rather than left diverging. */
const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '14px 16px',
  background: 'var(--mc-bg-surface)',
  border: '1px solid var(--mc-border-control)',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 16,
  color: 'var(--mc-text-primary)',
  boxSizing: 'border-box',
};

const helperStyle: CSSProperties = {
  fontFamily: 'var(--mc-font-body)',
  fontSize: 13,
  color: 'var(--mc-text-muted)',
};

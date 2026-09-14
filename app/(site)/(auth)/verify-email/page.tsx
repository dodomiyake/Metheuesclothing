import { Suspense } from 'react';
import { buttonStyle, ghostButtonStyle, titleStyle, subtextStyle } from '../../form-styles';
import { ExpiredVerificationForm } from './expired-form';

/**
 * Figma 28 — Email verification, States 2 and 3 (node 96:2806). Landed on
 * by /auth/callback after exchanging a sign-up confirmation link. State 4
 * ("Already verified") isn't distinguishable from State 3 here — Supabase's
 * exchangeCodeForSession fails the same way for an expired code and an
 * already-used one, so both surface as "link expired" rather than guessing
 * which happened.
 */
export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent searchParams={searchParams} />
    </Suspense>
  );
}

async function VerifyEmailContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  if (status === 'verified') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '1.4px',
            textTransform: 'uppercase',
            color: 'var(--mc-status-success)',
            margin: 0,
          }}
        >
          State 2 · Verified
        </p>
        <h1 style={titleStyle}>Email verified</h1>
        <p style={subtextStyle}>
          Your account is ready. Orders placed with this address are now linked to it, including
          the one you just made.
        </p>
        {/* "Go to your account" points at the homepage for now — the account
            overview page (11 Account Overview) isn't built yet. */}
        <a href="/" style={{ ...buttonStyle, textDecoration: 'none', textAlign: 'center', display: 'block' }}>
          Go to your account
        </a>
        <a href="/shop" style={{ ...ghostButtonStyle, textDecoration: 'none', textAlign: 'center' }}>
          Continue shopping
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '1.4px',
          textTransform: 'uppercase',
          color: 'var(--mc-status-error)',
          margin: 0,
        }}
      >
        State 3 · Link expired
      </p>
      <h1 style={titleStyle}>That link has expired</h1>
      <p style={subtextStyle}>
        Verification links last 24 hours. Send a fresh one and it will arrive in the same inbox.
      </p>
      <ExpiredVerificationForm />
    </div>
  );
}

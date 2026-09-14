'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  fieldStyle,
  labelStyle,
  inputStyle,
  helperStyle,
  buttonStyle,
  headStyle,
  titleStyle,
  subtextStyle,
  errorStyle,
} from '../../form-styles';

/**
 * Figma 27 — Password reset, States 3 and 4 (node 96:2731). State 4 shows
 * when /auth/callback could not exchange the emailed link's code (expired
 * or already used) and redirected here with ?error=expired, or when the
 * update itself fails for the same reason after a session did exist.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    params.get('error') === 'expired' ? 'expired' : null,
  );
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError('expired');
      return;
    }
    setDone(true);
  }

  if (error === 'expired') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--mc-status-error)', margin: 0 }}>
          State 4 · Link expired
        </p>
        <h1 style={titleStyle}>That link has expired</h1>
        <p style={subtextStyle}>
          Reset links last 60 minutes. Request a new one and it will arrive in the same inbox.
        </p>
        <a href="/forgot-password" style={{ ...buttonStyle, textDecoration: 'none', textAlign: 'center', display: 'block' }}>
          Send a new link
        </a>
        <a
          href="/sign-in"
          style={{ background: 'none', border: 'none', color: 'var(--mc-text-primary)', fontFamily: 'var(--mc-font-body)', fontSize: 16, fontWeight: 600, textAlign: 'center', textDecoration: 'none', padding: '14px 0' }}
        >
          Back to sign in
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={titleStyle}>Password updated</h1>
        <p style={subtextStyle}>
          <a href="/sign-in" style={{ color: 'var(--mc-text-primary)' }}>
            Sign in
          </a>{' '}
          with your new password.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={headStyle}>
        <h1 style={titleStyle}>Choose a new password</h1>
        <p style={subtextStyle}>Pick something you have not used elsewhere.</p>
      </div>
      <label style={fieldStyle}>
        <span style={labelStyle}>New password</span>
        <input
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        <p style={helperStyle}>
          At least 10 characters. A passphrase is easier to remember and harder to guess.
        </p>
      </label>
      {error && (
        <p role="alert" style={errorStyle}>
          Something went wrong. Please try again.
        </p>
      )}
      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  );
}

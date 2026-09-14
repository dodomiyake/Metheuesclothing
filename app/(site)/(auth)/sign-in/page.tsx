'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  fieldStyle,
  labelStyle,
  inputStyle,
  buttonStyle,
  secondaryButtonStyle,
  ghostButtonStyle,
  headStyle,
  titleStyle,
  subtextStyle,
  dividerStyle,
  smallPrintStyle,
  errorStyle,
} from '../../form-styles';

/** Figma 10A — Sign In (node 95:2620, file 9SzUlTWGVKOCkAULkbqOsr). */
export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
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
    window.location.href = '/';
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={headStyle}>
        <h1 style={titleStyle}>Sign in</h1>
        <p style={subtextStyle}>
          Track orders, save addresses and start returns without hunting for an email.
        </p>
      </div>

      {error && (
        <p role="alert" style={errorStyle}>
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
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'var(--mc-text-muted)' }}>
          <input
            type="checkbox"
            checked={keepSignedIn}
            onChange={(e) => setKeepSignedIn(e.target.checked)}
            style={{ width: 20, height: 20, flexShrink: 0 }}
          />
          Keep me signed in
        </label>
        <Link href="/forgot-password" style={{ ...ghostButtonStyle, textDecoration: 'none', display: 'inline-block' }}>
          Forgot password?
        </Link>
      </div>

      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <div style={dividerStyle}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--mc-text-muted)' }}>New to Metheues?</p>
        <Link href="/register" style={{ ...secondaryButtonStyle, textDecoration: 'none', textAlign: 'center' }}>
          Create an account
        </Link>
      </div>

      <p style={smallPrintStyle}>
        Trouble signing in? Check the email address you used at checkout — accounts are created
        against that address.
      </p>
    </form>
  );
}

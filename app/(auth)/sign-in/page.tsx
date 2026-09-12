'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { fieldStyle, labelStyle, inputStyle, buttonStyle, titleStyle, errorStyle } from '../form-styles';

export default function SignInPage() {
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
    window.location.href = '/';
  }

  return (
    <form onSubmit={onSubmit} style={{ fontFamily: 'var(--mc-font-body)' }}>
      <h1 style={titleStyle}>Sign in</h1>
      {error && (
        <p role="alert" style={errorStyle}>
          {error}
        </p>
      )}
      <label style={fieldStyle}>
        <span style={labelStyle}>Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </label>
      <label style={{ ...fieldStyle, marginBottom: 'var(--mc-space-lg)' }}>
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
      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <p style={{ fontSize: 'var(--mc-type-meta)', marginTop: 'var(--mc-space-lg)' }}>
        <Link href="/forgot-password" style={{ color: 'var(--mc-text-primary)' }}>
          Forgot your password?
        </Link>
      </p>
      <p style={{ fontSize: 'var(--mc-type-meta)', color: 'var(--mc-text-muted)' }}>
        New here? <Link href="/register" style={{ color: 'var(--mc-text-primary)' }}>Create an account</Link> — or
        check out as a guest, no account needed.
      </p>
    </form>
  );
}

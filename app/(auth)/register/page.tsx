'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { fieldStyle, labelStyle, inputStyle, buttonStyle, titleStyle, errorStyle } from '../form-styles';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName || undefined,
        marketing_opt_in: marketingOptIn,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Something went wrong. Please try again.');
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div style={{ fontFamily: 'var(--mc-font-body)' }}>
        <h1 style={titleStyle}>Check your email</h1>
        <p>
          We&rsquo;ve sent a link to {email} to confirm your address. Follow it to finish
          creating your account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ fontFamily: 'var(--mc-font-body)' }}>
      <h1 style={titleStyle}>Create an account</h1>
      <p style={{ fontSize: 'var(--mc-type-meta)', color: 'var(--mc-text-muted)' }}>
        An account saves your addresses and order history. You can still check out as a
        guest with no account at all.
      </p>
      {error && (
        <p role="alert" style={errorStyle}>
          {error}
        </p>
      )}
      <label style={fieldStyle}>
        <span style={labelStyle}>Full name</span>
        <input
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={inputStyle}
        />
      </label>
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
      <label style={fieldStyle}>
        <span style={labelStyle}>Password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
      </label>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 'var(--mc-space-lg)',
          fontSize: 'var(--mc-type-meta)',
        }}
      >
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
          style={{ width: 18, height: 18 }}
        />
        Email me about new drops and offers
      </label>
      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? 'Creating account…' : 'Create account'}
      </button>
      <p style={{ fontSize: 'var(--mc-type-meta)', marginTop: 'var(--mc-space-lg)' }}>
        Already have an account?{' '}
        <Link href="/sign-in" style={{ color: 'var(--mc-text-primary)' }}>
          Sign in
        </Link>
      </p>
    </form>
  );
}

'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { fieldStyle, labelStyle, inputStyle, buttonStyle, titleStyle } from '../form-styles';

const GENERIC_MESSAGE =
  'If an account exists for that address, we have sent a link to reset your password.';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    // The response is the same generic message whether the account exists,
    // whether it sent, or whether it was rate limited — never branch on
    // res.ok here, or the UI becomes the side channel the API deliberately
    // avoids being.
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div style={{ fontFamily: 'var(--mc-font-body)' }}>
        <h1 style={titleStyle}>Check your email</h1>
        <p>{GENERIC_MESSAGE}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ fontFamily: 'var(--mc-font-body)' }}>
      <h1 style={titleStyle}>Reset your password</h1>
      <label style={{ ...fieldStyle, marginBottom: 'var(--mc-space-lg)' }}>
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
      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? 'Sending…' : 'Send reset link'}
      </button>
      <p style={{ fontSize: 'var(--mc-type-meta)', marginTop: 'var(--mc-space-lg)' }}>
        <Link href="/sign-in" style={{ color: 'var(--mc-text-primary)' }}>
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

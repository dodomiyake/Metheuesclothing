'use client';

import { useState, type FormEvent } from 'react';
import { fieldStyle, labelStyle, inputStyle, buttonStyle, titleStyle, errorStyle } from '../form-styles';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
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
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Something went wrong. Please try again.');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div style={{ fontFamily: 'var(--mc-font-body)' }}>
        <h1 style={titleStyle}>Password updated</h1>
        <p>
          <a href="/sign-in" style={{ color: 'var(--mc-text-primary)' }}>
            Sign in
          </a>{' '}
          with your new password.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ fontFamily: 'var(--mc-font-body)' }}>
      <h1 style={titleStyle}>Choose a new password</h1>
      {error && (
        <p role="alert" style={errorStyle}>
          {error}
        </p>
      )}
      <label style={{ ...fieldStyle, marginBottom: 'var(--mc-space-lg)' }}>
        <span style={labelStyle}>New password</span>
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
      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  );
}

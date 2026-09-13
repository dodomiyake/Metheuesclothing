'use client';

import { useState, type FormEvent } from 'react';
import { buttonStyle, fieldStyle, labelStyle, inputStyle } from '../form-styles';

export function ExpiredVerificationForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return <p style={{ fontSize: 15, color: 'var(--mc-text-muted)' }}>Check {email} for the new link.</p>;
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? 'Sending…' : 'Send a new link'}
      </button>
    </form>
  );
}

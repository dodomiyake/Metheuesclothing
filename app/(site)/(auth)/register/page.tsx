'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  fieldStyle,
  labelStyle,
  inputStyle,
  helperStyle,
  buttonStyle,
  secondaryButtonStyle,
  headStyle,
  titleStyle,
  subtextStyle,
  dividerStyle,
  smallPrintStyle,
  errorStyle,
} from '../../form-styles';

/** Figma 10D — Create Account (node 95:2970, file 9SzUlTWGVKOCkAULkbqOsr). */
export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  function startCooldown() {
    setCooldown(60);
    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function registerRequest() {
    return fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName || undefined,
        marketing_opt_in: marketingOptIn,
      }),
    });
  }

  async function sendVerification() {
    await registerRequest().catch(() => {});
    startCooldown();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await registerRequest();
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Something went wrong. Please try again.');
      return;
    }
    setSubmitted(true);
    startCooldown();
  }

  if (submitted) {
    // Figma 28 — Email verification, State 1 · Check your email (node
    // 96:2806). "Change email address" just goes back to the form; there is
    // no separate change-of-address flow to build for an account that was
    // never confirmed.
    const mm = String(Math.floor(cooldown / 60)).padStart(1, '0');
    const ss = String(cooldown % 60).padStart(2, '0');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--mc-text-muted)', margin: 0 }}>
          State 1 · Check your email
        </p>
        <h1 style={titleStyle}>Verify your email</h1>
        <p style={subtextStyle}>
          We sent a verification link to {email}. Your orders and saved addresses unlock once it
          is confirmed.
        </p>
        <button
          type="button"
          disabled={cooldown > 0}
          onClick={sendVerification}
          style={cooldown > 0 ? { ...secondaryButtonStyle, color: 'var(--mc-text-muted)', cursor: 'not-allowed' } : secondaryButtonStyle}
        >
          {cooldown > 0 ? `Resend verification (available in ${mm}:${ss})` : 'Resend verification'}
        </button>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          style={{ background: 'none', border: 'none', color: 'var(--mc-text-primary)', fontFamily: 'var(--mc-font-body)', fontSize: 16, fontWeight: 600, cursor: 'pointer', padding: '14px 0' }}
        >
          Change email address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={headStyle}>
        <h1 style={titleStyle}>Create an account</h1>
        <p style={subtextStyle}>
          One account for orders, addresses and returns. You do not need one to buy — guest
          checkout stays open.
        </p>
      </div>

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
        <span style={labelStyle}>Email address</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <p style={helperStyle}>We send order confirmations and dispatch notices here.</p>
      </label>

      <label style={fieldStyle}>
        <span style={labelStyle}>Password</span>
        <input
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        <p style={helperStyle}>At least 10 characters. A passphrase beats a complicated short password.</p>
      </label>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 14, color: 'var(--mc-text-muted)' }}>
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
          style={{ width: 20, height: 20, flexShrink: 0, marginTop: 2 }}
        />
        Email me about new drops. No more than twice a month, and you can leave any time.
      </label>

      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? 'Creating account…' : 'Create account'}
      </button>

      <div style={dividerStyle}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--mc-text-muted)' }}>Already have an account?</p>
        <Link href="/sign-in" style={{ ...secondaryButtonStyle, textDecoration: 'none', textAlign: 'center' }}>
          Sign in instead
        </Link>
      </div>

      <p style={smallPrintStyle}>
        By creating an account you agree to the Terms and Conditions and the Privacy Policy.
      </p>
    </form>
  );
}

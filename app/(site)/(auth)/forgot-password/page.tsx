'use client';

import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import {
  fieldStyle,
  labelStyle,
  inputStyle,
  helperStyle,
  buttonStyle,
  disabledSecondaryButtonStyle,
  ghostButtonStyle,
  headStyle,
  titleStyle,
  subtextStyle,
  smallPrintStyle,
} from '../form-styles';

/**
 * Figma 27 — Password reset, States 1 and 2 (node 96:2731, file
 * 9SzUlTWGVKOCkAULkbqOsr). State 3 (set a new password) and 4 (link
 * expired) live on /reset-password, since those only make sense after the
 * emailed link has actually been followed.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]);

  async function request() {
    // The response is the same generic message whether the account exists,
    // whether it sent, or whether it was rate limited — never branch on
    // res.ok here, or the UI becomes the side channel the API deliberately
    // avoids being.
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    await request();
    setLoading(false);
    setSent(true);
    setCooldown(60);
  }

  if (sent) {
    const mm = String(Math.floor(cooldown / 60)).padStart(1, '0');
    const ss = String(cooldown % 60).padStart(2, '0');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--mc-status-success)', margin: 0 }}>
          State 2 · Link sent
        </p>
        <h1 style={titleStyle}>Check your email</h1>
        <p style={subtextStyle}>
          If an account exists for {email}, a reset link is on its way. It can take a minute or
          two to arrive.
        </p>
        <button
          type="button"
          disabled={cooldown > 0}
          onClick={async () => {
            await request();
            setCooldown(60);
          }}
          style={cooldown > 0 ? disabledSecondaryButtonStyle : { ...disabledSecondaryButtonStyle, color: 'var(--mc-text-primary)', cursor: 'pointer' }}
        >
          {cooldown > 0 ? `Resend link (available in ${mm}:${ss})` : 'Resend link'}
        </button>
        <Link href="/sign-in" style={{ ...ghostButtonStyle, textDecoration: 'none', textAlign: 'center' }}>
          Back to sign in
        </Link>
        <p style={smallPrintStyle}>
          We say &ldquo;if an account exists&rdquo; deliberately — confirming which addresses are
          registered would leak them.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={headStyle}>
        <h1 style={titleStyle}>Reset your password</h1>
        <p style={subtextStyle}>
          Enter the email address on your account and we will send a link to set a new password.
        </p>
      </div>
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
        <p style={helperStyle}>The link expires after 60 minutes for security.</p>
      </label>
      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? 'Sending…' : 'Send reset link'}
      </button>
      <Link href="/sign-in" style={{ ...ghostButtonStyle, textDecoration: 'none', textAlign: 'center' }}>
        Back to sign in
      </Link>
    </form>
  );
}

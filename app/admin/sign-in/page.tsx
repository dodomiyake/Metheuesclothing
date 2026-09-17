'use client';

import { useState, type FormEvent, type CSSProperties } from 'react';

/**
 * A01. Black ground, deliberately, so staff never mistake this for the
 * customer sign-in -- same underlying Supabase session either way (this
 * posts to the same /api/auth/sign-in the storefront uses), but this screen
 * exists so the two are never visually interchangeable. The role check
 * itself happens after sign-in, in app/admin/(protected)/layout.tsx --
 * signing in here does not by itself grant admin access.
 */
export default function AdminSignInPage() {
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
    window.location.href = '/admin/products';
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--mc-space-lg)',
        background: 'var(--mc-bg-inverse)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--mc-font-display)',
            fontSize: 15,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: 'var(--mc-text-inverse)',
            textAlign: 'center',
            marginBottom: 'var(--mc-space-xl)',
          }}
        >
          Metheues Admin
        </div>
        <form
          onSubmit={onSubmit}
          style={{
            fontFamily: 'var(--mc-font-body)',
            background: 'var(--mc-graphite)',
            padding: 'var(--mc-space-xl)',
            borderRadius: 'var(--mc-radius-md)',
            boxSizing: 'border-box',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--mc-font-display)',
              fontSize: 'var(--mc-type-section)',
              color: 'var(--mc-text-inverse)',
              marginTop: 0,
            }}
          >
            Sign in
          </h1>
          {error && (
            <p role="alert" style={{ color: '#FF9B8C', fontSize: 'var(--mc-type-body)' }}>
              {error}
            </p>
          )}
          <label style={{ display: 'block', marginBottom: 'var(--mc-space-md)' }}>
            <span
              style={{
                display: 'block',
                fontSize: 'var(--mc-type-label)',
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
                color: 'var(--mc-text-muted-inverse)',
                marginBottom: 'var(--mc-space-2xs)',
              }}
            >
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 'var(--mc-space-lg)' }}>
            <span
              style={{
                display: 'block',
                fontSize: 'var(--mc-type-label)',
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
                color: 'var(--mc-text-muted-inverse)',
                marginBottom: 'var(--mc-space-2xs)',
              }}
            >
              Password
            </span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              minHeight: 44,
              background: 'var(--mc-chalk)',
              color: 'var(--mc-ink)',
              border: 'none',
              borderRadius: 'var(--mc-radius-sm)',
              fontFamily: 'var(--mc-font-body)',
              fontSize: 'var(--mc-type-body)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p
          style={{
            fontFamily: 'var(--mc-font-body)',
            fontSize: 'var(--mc-type-caption)',
            color: 'var(--mc-text-muted-inverse)',
            textAlign: 'center',
            marginTop: 'var(--mc-space-lg)',
          }}
        >
          Sessions expire automatically. Every change here is written to the audit log.
        </p>
      </div>
    </main>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  border: '1px solid var(--mc-slate-on-dark)',
  borderRadius: 'var(--mc-radius-sm)',
  background: 'var(--mc-ink)',
  color: 'var(--mc-chalk)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 'var(--mc-type-body)',
  boxSizing: 'border-box',
};

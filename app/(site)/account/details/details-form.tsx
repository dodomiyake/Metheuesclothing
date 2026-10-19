'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fieldStyle, labelStyle, inputStyle, buttonStyle, errorStyle } from '@/app/(site)/form-styles';

/**
 * 18's two saving panels. Personal details and contact preferences post to
 * the same route, because they are the same row — the design's two Save
 * buttons are preserved, so each panel still saves only what it shows.
 */
export function DetailsForm({
  email,
  emailVerified,
  initial,
}: {
  email: string;
  emailVerified: boolean;
  initial: { full_name: string; phone: string; marketing_opt_in: boolean };
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.full_name);
  const [phone, setPhone] = useState(initial.phone);
  const [marketing, setMarketing] = useState(initial.marketing_opt_in);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function save(which: 'details' | 'preferences') {
    setBusy(which);
    setError(null);
    setSaved(null);
    const body =
      which === 'details'
        ? { full_name: fullName.trim() || null, phone: phone.trim() || null }
        : { marketing_opt_in: marketing };
    const res = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? 'Could not save your details.');
      return;
    }
    setSaved(which === 'details' ? 'Details saved.' : 'Preferences saved.');
    router.refresh();
  }

  return (
    <>
      {error && (
        <p role="alert" style={errorStyle}>
          {error}
        </p>
      )}
      {saved && (
        <p role="status" style={{ fontSize: 14, color: 'var(--mc-status-success)', margin: 0 }}>
          {saved}
        </p>
      )}

      <Panel title="Personal details">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Full name</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={inputStyle}
              autoComplete="name"
            />
          </label>

          <div style={fieldStyle}>
            <span style={labelStyle}>Email address</span>
            <input type="email" value={email} readOnly style={{ ...inputStyle, opacity: 0.7 }} />
            <span style={{ fontSize: 13, color: 'var(--mc-text-muted)' }}>
              {emailVerified
                ? 'Verified. Order confirmations are sent here.'
                : 'Not verified yet — check your inbox for the confirmation link.'}{' '}
              Changing the address on an account is not something you can do here yet; email us and
              we will move it.
            </span>
          </div>

          <label style={fieldStyle}>
            <span style={labelStyle}>Phone number</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
              autoComplete="tel"
            />
            <span style={{ fontSize: 13, color: 'var(--mc-text-muted)' }}>
              Stored with your account. Checkout asks Stripe for a delivery address rather than
              reading this, so it is not passed to a courier today.
            </span>
          </label>

          <div>
            <button type="button" onClick={() => save('details')} style={buttonStyle} disabled={busy !== null}>
              {busy === 'details' ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Contact preferences">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2 }}
            />
            <span>
              <span style={{ display: 'block', fontSize: 15 }}>Drop alerts by email</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--mc-text-muted)' }}>
                First access to new drops and restocks. No more than twice a month.
              </span>
            </span>
          </label>

          {/* A LOCKED ROW, not a tickbox nobody can untick — the Checkbox
              component's own rule, the same one that settled A14. */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span
              style={{
                border: '1px solid var(--mc-border-control)',
                borderRadius: 2,
                padding: '3px 6px',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                marginTop: 2,
              }}
            >
              Always on
            </span>
            <span>
              <span style={{ display: 'block', fontSize: 15 }}>Order and account emails</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--mc-text-muted)' }}>
                Confirmations, dispatch notices, returns and password changes. These are service
                messages, sent because you have an account, so they cannot be switched off.
              </span>
            </span>
          </div>

          <div>
            <button
              type="button"
              onClick={() => save('preferences')}
              style={buttonStyle}
              disabled={busy !== null}
            >
              {busy === 'preferences' ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </div>
      </Panel>
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'var(--mc-bg-surface)',
        border: '1px solid var(--mc-border-default)',
        borderRadius: 4,
        padding: 20,
      }}
    >
      <h2
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '1.4px',
          textTransform: 'uppercase',
          color: 'var(--mc-text-muted)',
          margin: '0 0 14px',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

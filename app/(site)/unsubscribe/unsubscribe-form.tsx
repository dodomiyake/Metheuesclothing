'use client';

import { useState } from 'react';

/**
 * The button that actually leaves the list.
 *
 * A BUTTON RATHER THAN A LINK, for the reason the route records: mail
 * clients and security scanners fetch links before a human sees them, so
 * an unsubscribe that happens on GET is an unsubscribe that happens
 * without anybody asking. Arriving at this page does nothing; pressing
 * this does.
 */
export function UnsubscribeForm({ token, email }: { token: string; email: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function unsubscribe() {
    setState('working');
    setError(null);
    try {
      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'Could not remove you just now.');
        setState('idle');
        return;
      }
      setState('done');
    } catch {
      setError('Could not reach the server. You are still subscribed.');
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <p role="status" style={{ fontSize: 16, lineHeight: '26px', margin: 0 }}>
        <strong>Done — {email} has been removed.</strong> You will not get any more marketing
        email from us. Order confirmations and delivery updates still arrive for anything you
        buy, because those are about a purchase rather than marketing.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error && (
        <p role="alert" style={{ margin: 0, color: 'var(--mc-text-danger)', fontSize: 15 }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={unsubscribe}
        disabled={state === 'working'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 44,
          alignSelf: 'flex-start',
          padding: '14px 28px',
          borderRadius: 'var(--mc-radius-sm)',
          border: 'none',
          background: 'var(--mc-action-primary-bg)',
          color: 'var(--mc-action-primary-text)',
          fontFamily: 'var(--mc-font-body)',
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: '0.32px',
          cursor: state === 'working' ? 'default' : 'pointer',
        }}
      >
        {state === 'working' ? 'Removing…' : 'Unsubscribe me'}
      </button>
    </div>
  );
}

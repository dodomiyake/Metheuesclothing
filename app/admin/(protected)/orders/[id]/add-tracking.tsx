'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { formatPence } from '@/lib/money';
import { StatusBadge } from '@/components/admin/status-badge';

/**
 * A14 Add tracking — Figma dialog 141:1860 (Desktop 141:1859 / Tablet
 * 141:1683; there is no Mobile frame, which is consistent with every other
 * admin action screen — see components/admin/wide-only.tsx).
 *
 * THE DESIGN CONTRADICTS ITSELF HERE, and the design system itself says how
 * to settle it. The dialog header reads "There is no separate send button —
 * the dispatch email goes out as part of this", and A13's copy repeats the
 * promise. Then the dialog draws a checkbox labelled "Send the dispatch
 * email now", which IS a separate send control: tick it off and you get an
 * order marked shipped with the customer told nothing, which is the state
 * the header exists to prevent.
 *
 * The Checkbox component's own description resolves it: "Use this only for
 * choices that can actually be changed; a setting that cannot be switched
 * off should be a locked row with an ALWAYS ON tag, not a checkbox nobody
 * can untick." So the email is always sent — ship_order and the /ship route
 * are built that way — and this renders the locked row the component
 * prescribes rather than a tickbox that lies about being optional. Worth
 * raising with the design owner alongside the "To pack" and E7 naming.
 *
 * Two other things in the dialog are not reproduced:
 *
 *  - CARRIER is a text input with suggestions, not the design's closed
 *    select. There is no carrier list anywhere in the schema — delivery_method
 *    is free text — so a fixed dropdown would be a config invented in a
 *    component. A managed list belongs in store_settings; until it exists,
 *    any carrier must be typeable, and the suggestions are only hints.
 *
 *  - The tracking link does NOT auto-fill from carrier and number, though
 *    the design's helper says it does. That needs a carrier-to-URL template
 *    per carrier, and guessing those formats is precisely the failure the
 *    field above warns about: "a wrong number is worse than none — the
 *    customer gets a link that says the parcel does not exist". The field is
 *    optional and E4 falls back to the order page when it is empty.
 *
 * The email preview drops the design's "expected 12–16 September" for the
 * same reason A12 does: no delivery estimate is stored or computed anywhere.
 */
const CARRIER_SUGGESTIONS = ['Royal Mail', 'DPD', 'Evri', 'DHL', 'UPS', 'FedEx', 'Yodel'];

export function AddTracking({
  orderId,
  orderNumber,
  customer,
  email,
  itemCount,
  totalPence,
  paymentLabel,
}: {
  orderId: string;
  orderNumber: string;
  customer: string;
  email: string;
  itemCount: number;
  totalPence: number;
  paymentLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/admin/orders/${orderId}/ship`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carrier: carrier.trim(),
        tracking_number: trackingNumber.trim(),
        ...(trackingUrl.trim() ? { tracking_url: trackingUrl.trim() } : {}),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      // ship_order's messages name the order and its state; they are written
      // for whoever is standing at the packing bench.
      setError(body.error ?? 'Could not add tracking. Please try again.');
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={primaryButtonStyle}>
        Add tracking
      </button>
    );
  }

  const canSubmit = carrier.trim().length > 0 && trackingNumber.trim().length > 0;

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Add tracking</p>
        <p style={{ fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)', margin: 0 }}>
          Adding a carrier and number marks this order shipped. There is no separate send button —
          the dispatch email goes out as part of this.
        </p>
      </div>

      <div aria-hidden style={{ height: 1, background: 'var(--mc-border-default)' }} />

      <div
        style={{
          background: 'var(--mc-bg-page)',
          border: '1px solid var(--mc-border-default)',
          borderRadius: 'var(--mc-radius-md)',
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ flex: '1 0 0', minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{orderNumber}</p>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
            {customer} · {itemCount} item{itemCount === 1 ? '' : 's'} · {formatPence(totalPence)}
          </p>
        </div>
        <StatusBadge label={paymentLabel} tone="success" />
      </div>

      <label style={fieldStyle}>
        <span style={labelStyle}>Carrier</span>
        <input
          list="mc-carriers"
          required
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          style={inputStyle}
        />
        <datalist id="mc-carriers">
          {CARRIER_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <span style={helperStyle}>
          Suggestions only — type any carrier. There is no managed carrier list yet.
        </span>
      </label>

      <label style={fieldStyle}>
        <span style={labelStyle}>Tracking number</span>
        <input required value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} style={inputStyle} />
        <span style={helperStyle}>
          Copy it exactly from the label. A wrong number is worse than none — the customer gets a
          link that says the parcel does not exist.
        </span>
      </label>

      <label style={fieldStyle}>
        <span style={labelStyle}>Tracking link</span>
        <input
          type="url"
          inputMode="url"
          placeholder="https://"
          value={trackingUrl}
          onChange={(e) => setTrackingUrl(e.target.value)}
          style={inputStyle}
        />
        <span style={helperStyle}>
          Optional. Paste the carrier&rsquo;s own link if you have it — it is not generated, because
          a guessed link is the same problem as a wrong number. Without one the email links to the
          order page instead.
        </span>
      </label>

      {/* The locked row the Checkbox component prescribes for a setting that
          cannot be switched off — see this file's header for why the design's
          tickbox is not reproduced. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          minHeight: 44,
          padding: '11px 0',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            color: 'var(--mc-text-muted)',
            border: '1px solid var(--mc-border-control)',
            borderRadius: 999,
            padding: '3px 8px',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Always on
        </span>
        <span style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)' }}>
          The dispatch email sends as part of this. An order marked shipped while the customer has
          been told nothing is the thing this screen exists to prevent.
        </span>
      </div>

      <div
        style={{
          background: 'var(--mc-bg-page)',
          border: '1px solid var(--mc-border-default)',
          borderRadius: 'var(--mc-radius-md)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <p style={{ ...labelStyle, fontSize: 10, color: 'var(--mc-text-muted)', letterSpacing: '1.2px' }}>
          What the customer receives
        </p>
        <div aria-hidden style={{ height: 1, background: 'var(--mc-border-default)' }} />
        <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
          Order {orderNumber} is on its way
        </p>
        <p style={{ fontSize: 12, lineHeight: '18px', color: 'var(--mc-text-muted)', margin: 0 }}>
          To {email} · Order {orderNumber}
          {carrier.trim() ? ` · ${carrier.trim()}` : ''}
          {trackingNumber.trim() ? ` ${trackingNumber.trim()}` : ''}
        </p>
      </div>

      {error && (
        <p role="alert" style={{ fontSize: 14, fontWeight: 600, color: 'var(--mc-status-error)', margin: 0 }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <button
          type="submit"
          disabled={!canSubmit || saving}
          style={{
            ...primaryButtonStyle,
            ...(canSubmit && !saving
              ? {}
              : {
                  background: 'var(--mc-mist)',
                  color: 'var(--mc-text-muted)',
                  cursor: 'not-allowed',
                }),
          }}
        >
          {saving ? 'Adding…' : 'Add tracking and mark shipped'}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={ghostButtonStyle}>
          Cancel
        </button>
      </div>

      {/* The Button component requires a disabled control to say what would
          enable it. */}
      {!canSubmit && (
        <p style={{ fontSize: 12, lineHeight: '18px', color: 'var(--mc-text-muted)', margin: 0 }}>
          Available once a carrier and a tracking number are both filled in.
        </p>
      )}
    </form>
  );
}

const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' };

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--mc-font-body)',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '1.44px',
  textTransform: 'uppercase',
  color: 'var(--mc-text-primary)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 46,
  padding: '12px 14px',
  background: 'var(--mc-bg-surface)',
  border: '1px solid var(--mc-border-control)',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 15,
  color: 'var(--mc-text-primary)',
  boxSizing: 'border-box',
};

const helperStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--mc-text-muted)',
};

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '14px 24px',
  background: 'var(--mc-action-primary-bg)',
  color: 'var(--mc-action-primary-text)',
  border: 'none',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: '0.32px',
  cursor: 'pointer',
};

const ghostButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: 'none',
  color: 'var(--mc-text-primary)',
};

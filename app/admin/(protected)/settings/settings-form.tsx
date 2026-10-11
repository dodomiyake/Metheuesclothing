'use client';

import { useState } from 'react';
import { StatusBadge } from '@/components/admin/status-badge';

export type SettingsValues = {
  free_delivery_threshold_pence: number;
  delivery_tracked_48_pence: number;
  delivery_next_day_pence: number;
  return_window_days: number;
  vat_rate_basis_points: number;
  contact_email: string;
  maintenance_mode: boolean;
};

export function SettingsForm({
  initial,
  isOwner,
  staff,
  senderAddress,
  children,
}: {
  initial: SettingsValues;
  isOwner: boolean;
  staff: { name: string; email: string; role: string }[];
  senderAddress: string | null;
  /** The read-only side panels, rendered on the server. */
  children?: React.ReactNode;
}) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  };

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'Could not save the settings.');
        return;
      }
      setSaved(true);
    } catch {
      setError('Could not reach the server. Nothing was saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mc-admin-page">
      <div className="mc-admin-topbar">
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
            Store settings
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
            Numbers here are the ones checkout actually uses. Changing them changes what customers pay.
          </p>
        </div>
        {isOwner && (
          <button type="button" onClick={save} disabled={saving} style={primaryButton(saving)}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        )}
      </div>

      <div className="mc-admin-content">
        {!isOwner && (
          <p style={{ ...mutedSmall, margin: 0 }}>
            You are signed in as staff, so this screen is read-only. Only an owner can change what
            customers are charged — which is the line A22 draws itself.
          </p>
        )}
        {error && (
          <p role="alert" style={{ fontSize: 14, color: 'var(--mc-status-error)', margin: 0 }}>
            {error}
          </p>
        )}
        {saved && !error && (
          <p role="status" style={{ fontSize: 14, color: 'var(--mc-status-success)', margin: 0 }}>
            Saved. Checkout is using these numbers from the next basket onwards.
          </p>
        )}

        <div className="mc-admin-order-layout mc-admin-customer-layout">
          <div className="mc-admin-order-main">
            <Panel heading="Delivery">
              <Money
                label="Tracked 48"
                pence={values.delivery_tracked_48_pence}
                onChange={(p) => set('delivery_tracked_48_pence', p)}
                disabled={!isOwner}
                helper="What a standard order is charged, unless the basket clears the free-delivery threshold below."
              />
              <Money
                label="Next day"
                pence={values.delivery_next_day_pence}
                onChange={(p) => set('delivery_next_day_pence', p)}
                disabled={!isOwner}
                helper="Always charged. The free-delivery threshold has never applied to next day, and still does not."
              />
              <Money
                label="Free delivery over"
                pence={values.free_delivery_threshold_pence}
                onChange={(p) => set('free_delivery_threshold_pence', p)}
                disabled={!isOwner}
                helper="Must match the announcement bar wording. Nothing checks that for you."
              />
              <p style={mutedSmall}>
                These two methods are the only ones checkout offers, and it ships to the UK and
                Ireland only. The design draws rows for Republic of Ireland and Rest of Europe as
                separate prices — that is a per-country rate table, which does not exist, so a
                price for it would be a promise about a parcel nobody can order.
              </p>
            </Panel>

            <Panel heading="Returns">
              <NumberField
                label="Return window (days)"
                value={values.return_window_days}
                onChange={(n) => set('return_window_days', n)}
                disabled={!isOwner}
                min={14}
                max={365}
                helper="Counted from delivery, not from the order date — which is what request_return() enforces. 14 is the statutory minimum, so the form will not go below it."
              />
              <p style={mutedSmall}>
                Two things the design puts here are not editable. The collection fee is a real
                column and nothing applies it to a refund, so a number typed in would be recorded
                and ignored. The condition rules textarea has no column at all — the wording lives
                in the returns page and the E6 email today, and moving it here means one source
                for both, which is worth doing and is not two lines.
              </p>
            </Panel>

            <Panel heading="Tax">
              <NumberField
                label="VAT rate (%)"
                value={values.vat_rate_basis_points / 100}
                onChange={(n) => set('vat_rate_basis_points', Math.round(n * 100))}
                disabled={!isOwner}
                min={0}
                max={100}
                step={0.01}
                helper="Stored in basis points, so 20% is 2000. Used to show the VAT already included in a price — it is never added on top."
              />
              <p style={mutedSmall}>
                The design has two tick boxes here: prices include VAT, and duties collected at
                checkout. Neither is a setting. Prices in this shop are VAT-inclusive throughout,
                which is what UK consumer law requires and what every total already assumes — a
                switch implying you could turn it off would be the most expensive wrong tick on
                this screen. Nothing collects duties, because nothing ships outside the UK and
                Ireland.
              </p>
            </Panel>

            <Panel heading="Contact">
              <TextField
                label="Customer email"
                value={values.contact_email}
                onChange={(v) => set('contact_email', v)}
                disabled={!isOwner}
                helper="Where return requests tell the customer to write. It is the address printed in the E6 email."
              />
              <p style={mutedSmall}>
                Trading name, registered address, company number and VAT number are on the design
                and have no columns anywhere. They belong in the footer and on invoices, where
                they are a legal requirement — which is also why they are on the list waiting for
                legal review rather than being typed in here.
              </p>
            </Panel>
          </div>

          <div className="mc-admin-order-side">
            {children}

            <Panel heading="Emails">
              <Row label="Sender address" value={senderAddress ?? 'Not configured'} />
              <p style={mutedSmall}>
                Set as an environment variable, not here: Resend will only send from a domain it
                has verified, so the address and the deployment have to agree. A column for it
                exists and is unread, which is worth tidying one way or the other.
              </p>
              <p style={mutedSmall}>
                Order confirmations, dispatch notices and returns emails are service messages.
                They are always sent and cannot be switched off while an order exists.
              </p>
            </Panel>

            <Panel heading="Who can sign in">
              {staff.length === 0 ? (
                <p style={mutedSmall}>Nobody has a staff or owner role yet.</p>
              ) : (
                staff.map((p, i) => (
                  <div
                    key={p.email}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      paddingTop: i === 0 ? 0 : 11,
                      borderTop: i === 0 ? undefined : '1px solid var(--mc-border-default)',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                    <span style={{ fontSize: 12, lineHeight: '18px', color: 'var(--mc-text-muted)' }}>
                      {p.role === 'owner'
                        ? 'Owner — everything, including refunds and these settings'
                        : 'Staff — orders, fulfilment and returns, no settings'}{' '}
                      · {p.email}
                    </span>
                  </div>
                ))
              )}
              <p style={mutedSmall}>
                There is no invite flow, so the design&rsquo;s &ldquo;Invite someone&rdquo; is not
                a button. Someone becomes staff by registering normally and having an owner change
                their role in the database — deliberately, per the README: there is no
                self-service way in.
              </p>
            </Panel>

            <Panel heading="Pausing the store" tint>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px' }}>
                <StatusBadge
                  label={values.maintenance_mode ? 'Paused — not taking orders' : 'Open for orders'}
                  tone={values.maintenance_mode ? 'attention' : 'success'}
                />
              </div>
              <p style={mutedSmall}>
                Maintenance mode keeps the site readable and stops anything being bought: the
                storefront carries on browsing normally and checkout refuses with a message. Use
                it between drops rather than unpublishing every product.
              </p>
              <button
                type="button"
                disabled={!isOwner}
                onClick={() => set('maintenance_mode', !values.maintenance_mode)}
                style={{ ...secondaryButton, width: '100%', opacity: isOwner ? 1 : 0.5 }}
              >
                {values.maintenance_mode ? 'Turn off maintenance mode' : 'Turn on maintenance mode'}
              </button>
              {values.maintenance_mode !== initial.maintenance_mode && (
                <p style={{ ...mutedSmall, color: 'var(--mc-status-attention)' }}>
                  Not saved yet — Save settings is what actually pauses or restarts the shop.
                </p>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- primitives */

export function Panel({
  heading,
  tint,
  children,
}: {
  heading: string;
  tint?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: tint ? 'var(--mc-bg-page)' : 'var(--mc-bg-surface)',
        border: '1px solid var(--mc-border-default)',
        borderRadius: 'var(--mc-radius-md)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxSizing: 'border-box',
      }}
    >
      <h2
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          color: 'var(--mc-text-muted)',
          margin: 0,
        }}
      >
        {heading}
      </h2>
      <div aria-hidden style={{ height: 1, width: '100%', background: 'var(--mc-border-default)' }} />
      {children}
    </section>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, color: 'var(--mc-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

/**
 * Money in, money out, integer pence in the middle (rule 1). The input
 * shows pounds because that is what a person types; the value held in
 * state and sent to the route is always pence, converted here with a
 * round rather than left as a float to be parsed later.
 */
function Money({
  label,
  pence,
  onChange,
  helper,
  disabled,
}: {
  label: string;
  pence: number;
  onChange: (pence: number) => void;
  helper?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState((pence / 100).toFixed(2));
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden style={{ fontSize: 15, color: 'var(--mc-text-muted)' }}>
          £
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number.parseFloat(e.target.value);
            if (Number.isFinite(n) && n >= 0) onChange(Math.round(n * 100));
          }}
          onBlur={() => setText((pence / 100).toFixed(2))}
          style={{ ...inputStyle, maxWidth: 200 }}
        />
      </span>
      {helper && <span style={mutedSmall}>{helper}</span>}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  helper,
  disabled,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  helper?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={labelStyle}>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        disabled={disabled}
        onChange={(e) => {
          const n = Number.parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        style={{ ...inputStyle, maxWidth: 200 }}
      />
      {helper && <span style={mutedSmall}>{helper}</span>}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  helper,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper?: string;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={labelStyle}>{label}</span>
      <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
      {helper && <span style={mutedSmall}>{helper}</span>}
    </label>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  color: 'var(--mc-text-muted)',
};

/* --mc-border-control, never --mc-border-default (rule 8). */
const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 46,
  padding: '12px 14px',
  border: '1px solid var(--mc-border-control)',
  borderRadius: 'var(--mc-radius-sm)',
  background: 'var(--mc-bg-surface)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 15,
  color: 'var(--mc-text-primary)',
  boxSizing: 'border-box',
};

const mutedSmall: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--mc-text-muted)',
  margin: 0,
};

const buttonBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '14px 24px',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: '0.32px',
  boxSizing: 'border-box',
};

const primaryButton = (busy: boolean): React.CSSProperties => ({
  ...buttonBase,
  background: 'var(--mc-action-primary-bg)',
  color: 'var(--mc-action-primary-text)',
  border: 'none',
  cursor: busy ? 'default' : 'pointer',
  opacity: busy ? 0.7 : 1,
  whiteSpace: 'nowrap',
});

const secondaryButton: React.CSSProperties = {
  ...buttonBase,
  border: '1px solid var(--mc-border-strong)',
  background: 'none',
  color: 'var(--mc-text-primary)',
  cursor: 'pointer',
};

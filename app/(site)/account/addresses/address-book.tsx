'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fieldStyle, labelStyle, inputStyle, buttonStyle, errorStyle } from '@/app/(site)/form-styles';

export type SavedAddress = {
  id: string;
  label: string | null;
  recipient: string;
  line1: string;
  line2: string | null;
  city: string;
  postcode: string;
  country_code: string;
  phone: string | null;
  is_default: boolean;
};

const COUNTRY_NAMES: Record<string, string> = {
  GB: 'United Kingdom',
  IE: 'Republic of Ireland',
};

type Draft = {
  label: string;
  recipient: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  country_code: 'GB' | 'IE';
  phone: string;
};

const EMPTY: Draft = {
  label: '',
  recipient: '',
  line1: '',
  line2: '',
  city: '',
  postcode: '',
  country_code: 'GB',
  phone: '',
};

/**
 * The cards and the form behind 30 Saved Addresses.
 *
 * THE DEFAULT IS NAMED IN TEXT, never marked by colour — each card carries
 * a bordered uppercase tag, which is what the frame draws and what rule 8
 * requires. The tag is also what tells the three card variants apart:
 * default, alternative, and an address in the Republic of Ireland.
 */
export function AddressBook({ initial }: { initial: SavedAddress[] }) {
  const router = useRouter();
  const [addresses, setAddresses] = useState(initial);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startNew() {
    setDraft(EMPTY);
    setEditing('new');
    setError(null);
  }

  function startEdit(address: SavedAddress) {
    setDraft({
      label: address.label ?? '',
      recipient: address.recipient,
      line1: address.line1,
      line2: address.line2 ?? '',
      city: address.city,
      postcode: address.postcode,
      country_code: address.country_code === 'IE' ? 'IE' : 'GB',
      phone: address.phone ?? '',
    });
    setEditing(address.id);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const body = {
      label: draft.label.trim() || null,
      recipient: draft.recipient.trim(),
      line1: draft.line1.trim(),
      line2: draft.line2.trim() || null,
      city: draft.city.trim(),
      postcode: draft.postcode.trim(),
      country_code: draft.country_code,
      phone: draft.phone.trim() || null,
    };
    const res = await fetch(
      editing === 'new' ? '/api/account/addresses' : `/api/account/addresses/${editing}`,
      {
        method: editing === 'new' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    setBusy(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? 'Could not save that address.');
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function act(id: string, action: 'default' | 'remove') {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/account/addresses/${id}`, {
      method: action === 'remove' ? 'DELETE' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: action === 'remove' ? undefined : JSON.stringify({ is_default: true }),
    });
    setBusy(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? 'Could not update that address.');
      return;
    }
    if (action === 'remove') setAddresses((list) => list.filter((a) => a.id !== id));
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 840, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
          {addresses.length === 0
            ? 'No saved addresses yet'
            : `${addresses.length} saved ${addresses.length === 1 ? 'address' : 'addresses'}`}
        </p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)' }}>
          Addresses saved here are yours to keep and edit. Checkout collects the delivery address
          itself through Stripe, so what you order is always sent where you say at the time — these
          are the ones you can copy from.
        </p>
        <button type="button" onClick={startNew} style={buttonStyle} disabled={busy}>
          Add a new address
        </button>
      </div>

      {error && (
        <p role="alert" style={errorStyle}>
          {error}
        </p>
      )}

      {editing && (
        <div
          style={{
            background: 'var(--mc-bg-surface)',
            border: '1px solid var(--mc-border-default)',
            borderRadius: 4,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
            {editing === 'new' ? 'New address' : 'Edit address'}
          </p>
          <Field label="Label (optional)" value={draft.label} onChange={(v) => setDraft({ ...draft, label: v })} />
          <Field label="Recipient" value={draft.recipient} onChange={(v) => setDraft({ ...draft, recipient: v })} />
          <Field label="Address line 1" value={draft.line1} onChange={(v) => setDraft({ ...draft, line1: v })} />
          <Field label="Address line 2 (optional)" value={draft.line2} onChange={(v) => setDraft({ ...draft, line2: v })} />
          <Field label="Town or city" value={draft.city} onChange={(v) => setDraft({ ...draft, city: v })} />
          <Field label="Postcode" value={draft.postcode} onChange={(v) => setDraft({ ...draft, postcode: v })} />
          <label style={fieldStyle}>
            <span style={labelStyle}>Country</span>
            <select
              value={draft.country_code}
              onChange={(e) => setDraft({ ...draft, country_code: e.target.value as 'GB' | 'IE' })}
              style={inputStyle}
            >
              <option value="GB">United Kingdom</option>
              <option value="IE">Republic of Ireland</option>
            </select>
          </label>
          <Field label="Phone (optional)" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={save} style={buttonStyle} disabled={busy}>
              {busy ? 'Saving…' : 'Save address'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="mc-button-ghost"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {addresses.length > 0 && (
        <div className="mc-address-grid">
          {addresses.map((address) => (
            <article
              key={address.id}
              style={{
                background: 'var(--mc-bg-surface)',
                border: '1px solid var(--mc-border-default)',
                borderRadius: 4,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <span
                style={{
                  alignSelf: 'flex-start',
                  border: '1px solid var(--mc-border-control)',
                  borderRadius: 2,
                  padding: '4px 8px',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '1.1px',
                  textTransform: 'uppercase',
                  color: 'var(--mc-text-primary)',
                }}
              >
                {address.is_default
                  ? 'Default delivery address'
                  : address.country_code === 'IE'
                    ? 'International — Republic of Ireland'
                    : (address.label ?? 'Alternative address')}
              </span>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{address.recipient}</p>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                <p style={{ margin: 0 }}>{address.line1}</p>
                {address.line2 && <p style={{ margin: 0 }}>{address.line2}</p>}
                <p style={{ margin: 0 }}>{address.city}</p>
                <p style={{ margin: 0 }}>{address.postcode}</p>
                <p style={{ margin: 0 }}>{COUNTRY_NAMES[address.country_code] ?? address.country_code}</p>
              </div>
              {address.phone && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--mc-text-muted)' }}>{address.phone}</p>
              )}
              <div style={{ height: 1, background: 'var(--mc-border-default)' }} />
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Action label="Edit" onClick={() => startEdit(address)} disabled={busy} />
                <Action label="Remove" onClick={() => act(address.id, 'remove')} disabled={busy} />
                {!address.is_default && (
                  <Action label="Set as default" onClick={() => act(address.id, 'default')} disabled={busy} />
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {addresses.length === 0 && !editing && (
        <div
          style={{
            background: 'var(--mc-bg-surface)',
            border: '1px solid var(--mc-border-default)',
            borderRadius: 4,
            padding: 28,
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>No saved addresses yet</p>
          <p style={{ margin: '8px 0 16px', fontSize: 14, color: 'var(--mc-text-muted)' }}>
            Save the one you use most and the next order takes a few taps instead of a form.
          </p>
          <button type="button" onClick={startNew} style={buttonStyle}>
            Add a new address
          </button>
        </div>
      )}

      {/* 106:3800. The design's "controlled list of international
          destinations" and its duties line both overstate what checkout
          does: it ships to GB and IE and collects no duties at all. The
          Shipping Policy link goes with screen 33, which is unbuilt. */}
      <div
        style={{
          background: 'var(--mc-bg-page)',
          border: '1px solid var(--mc-border-default)',
          borderRadius: 4,
          padding: '16px 18px',
        }}
      >
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Where we deliver</p>
        <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)' }}>
          We deliver across the United Kingdom and to the Republic of Ireland. Prices include VAT,
          and there is nothing to pay on delivery.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </label>
  );
}

function Action({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 44,
        padding: 0,
        background: 'none',
        border: 'none',
        fontFamily: 'var(--mc-font-body)',
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--mc-text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textDecoration: 'underline',
      }}
    >
      {label}
    </button>
  );
}

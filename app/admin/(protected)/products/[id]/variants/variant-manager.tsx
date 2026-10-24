'use client';

import { useId, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { formatPence, parsePounds } from '@/lib/money';
import { ModalDialog } from '@/components/admin/modal-dialog';
import {
  sectionLabelStyle,
  primaryButtonStyle,
  disabledButtonStyle,
  ghostButtonStyle,
  panelStyle,
  mutedSmallStyle,
  ruleStyle,
} from '@/components/admin/dialog-styles';

type Variant = {
  id: string;
  colour: string;
  size: string;
  sku: string;
  price_pence: number;
  stock_quantity: number;
  is_active: boolean;
};

const REASONS = [
  'Stocktake correction',
  'Goods received',
  'Damaged / written off',
  'Return restocked manually',
  'Other',
];

export function VariantManager({ productId, variants }: { productId: string; variants: Variant[] }) {
  return (
    <div style={{ fontFamily: 'var(--mc-font-body)' }}>
      <GenerateForm productId={productId} existing={variants} />
      <VariantsTable variants={variants} />
    </div>
  );
}

function GenerateForm({ productId, existing }: { productId: string; existing: Variant[] }) {
  const router = useRouter();
  const [coloursInput, setColoursInput] = useState('');
  const [sizesInput, setSizesInput] = useState('');
  const [pricePounds, setPricePounds] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const colours = useMemo(
    () => coloursInput.split(',').map((s) => s.trim()).filter(Boolean),
    [coloursInput],
  );
  const sizes = useMemo(
    () => sizesInput.split(',').map((s) => s.trim()).filter(Boolean),
    [sizesInput],
  );

  const existingKeys = useMemo(
    () => new Set(existing.map((v) => `${v.colour.toLowerCase()}::${v.size.toLowerCase()}`)),
    [existing],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!colours.length || !sizes.length) {
      setError('Add at least one colour and one size.');
      return;
    }
    let price_pence: number;
    try {
      price_pence = parsePounds(pricePounds);
    } catch {
      setError('Enter a price, e.g. 68.00');
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/admin/products/${productId}/variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colours, sizes, price_pence }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not generate variants.');
      return;
    }
    setColoursInput('');
    setSizesInput('');
    setPricePounds('');
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        border: '1px solid var(--mc-border-default)',
        borderRadius: 'var(--mc-radius-md)',
        padding: 'var(--mc-space-lg)',
        marginBottom: 'var(--mc-space-xl)',
        maxWidth: 640,
      }}
    >
      <h2 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-card-title)', marginTop: 0 }}>
        Generate variants
      </h2>
      {error && (
        <p role="alert" style={{ color: 'var(--mc-status-error)' }}>
          {error}
        </p>
      )}
      <Field label="Colours (comma separated)">
        <input
          value={coloursInput}
          onChange={(e) => setColoursInput(e.target.value)}
          placeholder="Black, Bone, Ivory"
          style={inputStyle}
        />
      </Field>
      <Field label="Sizes (comma separated)">
        <input
          value={sizesInput}
          onChange={(e) => setSizesInput(e.target.value)}
          placeholder="S, M, L, XL"
          style={inputStyle}
        />
      </Field>
      <Field label="Price (£, applied to every new variant)">
        <input
          value={pricePounds}
          onChange={(e) => setPricePounds(e.target.value)}
          placeholder="68.00"
          style={inputStyle}
        />
      </Field>

      {colours.length > 0 && sizes.length > 0 && (
        <div style={{ margin: '0 0 var(--mc-space-md)', overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th></th>
                {sizes.map((size) => (
                  <th key={size} style={matrixHeadStyle}>
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colours.map((colour) => (
                <tr key={colour}>
                  <th style={matrixHeadStyle}>{colour}</th>
                  {sizes.map((size) => {
                    const exists = existingKeys.has(`${colour.toLowerCase()}::${size.toLowerCase()}`);
                    return (
                      <td key={size} style={matrixCellStyle}>
                        <span
                          style={{
                            fontSize: 'var(--mc-type-caption)',
                            color: exists ? 'var(--mc-text-muted)' : 'var(--mc-teal)',
                            fontWeight: exists ? 400 : 700,
                          }}
                        >
                          {exists ? 'exists' : 'new'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="submit" disabled={saving} style={buttonStyle}>
        {saving ? 'Generating…' : 'Generate'}
      </button>
    </form>
  );
}

function VariantsTable({ variants }: { variants: Variant[] }) {
  if (!variants.length) {
    return <p style={{ color: 'var(--mc-text-muted)' }}>No variants yet — generate some above.</p>;
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--mc-border-default)', textAlign: 'left' }}>
          <Th>Colour / size</Th>
          <Th>SKU</Th>
          <Th>Price</Th>
          <Th>Stock</Th>
          <Th>Active</Th>
          <Th>Adjust stock</Th>
        </tr>
      </thead>
      <tbody>
        {variants.map((variant) => (
          <VariantRow key={variant.id} variant={variant} />
        ))}
      </tbody>
    </table>
  );
}

function VariantRow({ variant }: { variant: Variant }) {
  const router = useRouter();
  const [active, setActive] = useState(variant.is_active);
  const [togglingActive, setTogglingActive] = useState(false);
  const [mode, setMode] = useState<'add' | 'remove' | 'set'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReduce, setConfirmReduce] = useState(false);
  const reduceTitleId = useId();

  async function toggleActive() {
    setTogglingActive(true);
    const next = !active;
    const res = await fetch(`/api/admin/variants/${variant.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: next }),
    });
    setTogglingActive(false);
    if (res.ok) {
      setActive(next);
      router.refresh();
    }
  }

  const amountNumber = Number(amount);
  const amountValid = Number.isInteger(amountNumber) && amountNumber >= 0 && amount.trim() !== '';
  /**
   * The resulting stock, so the confirmation can show it rather than make
   * someone do the arithmetic. adjust_stock (010) clamps nothing — it
   * REFUSES to take stock below zero — so a Remove larger than the stock
   * is shown as the refusal it will be rather than as a figure.
   */
  const resulting = !amountValid
    ? null
    : mode === 'add'
      ? variant.stock_quantity + amountNumber
      : mode === 'set'
        ? amountNumber
        : variant.stock_quantity - amountNumber;

  /**
   * §9.6: "Refund, cancellation, product archive and negative stock
   * adjustments require explicit confirmation and audit logging." The audit
   * row has been written since migration 015; the confirmation is this.
   *
   * A reduction is what is confirmed, not a mode — "Set to 2" on a variant
   * holding 14 takes twelve T-shirts out of the shop just as surely as
   * "Remove 12", and it is the easier of the two to do by accident.
   */
  const isReducing = amountValid && resulting !== null && resulting < variant.stock_quantity;

  async function onAdjustStock(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amountValid) {
      setError('Enter a whole number.');
      return;
    }
    if (isReducing && !confirmReduce) {
      setConfirmReduce(true);
      return;
    }
    await applyAdjustment();
  }

  async function applyAdjustment() {
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/admin/variants/${variant.id}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, amount: amountNumber, reason, note: note || undefined }),
    });
    setSaving(false);
    setConfirmReduce(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not adjust stock.');
      return;
    }
    setAmount('');
    setNote('');
    router.refresh();
  }

  return (
    <tr style={{ borderBottom: '1px solid var(--mc-border-default)' }}>
      <Td>
        {variant.colour} / {variant.size}
      </Td>
      <Td>{variant.sku}</Td>
      <Td>{formatPence(variant.price_pence)}</Td>
      <Td>{variant.stock_quantity}</Td>
      <Td>
        <button
          type="button"
          onClick={toggleActive}
          disabled={togglingActive}
          style={{
            minHeight: 32,
            padding: '2px 10px',
            borderRadius: 999,
            border: '1px solid var(--mc-border-control)',
            // Was a hardcoded #E4F1E8 tint that no palette this project has
            // had ever contained; it survived both recolours because a raw
            // hex is invisible to a token change. The state is carried by
            // the word and a tone dot now, like every other admin badge.
            background: 'var(--mc-bg-surface)',
            color: 'var(--mc-text-primary)',
            fontSize: 'var(--mc-type-caption)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              marginRight: 7,
              background: active ? 'var(--mc-status-success)' : 'var(--mc-text-muted)',
            }}
          />
          {active ? 'Active' : 'Inactive'}
        </button>
      </Td>
      <Td>
        <form
          onSubmit={onAdjustStock}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--mc-space-2xs)', alignItems: 'center' }}
        >
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} style={smallInputStyle}>
            <option value="add">Add</option>
            <option value="remove">Remove</option>
            <option value="set">Set to</option>
          </select>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Qty"
            inputMode="numeric"
            style={{ ...smallInputStyle, width: 64 }}
          />
          <select value={reason} onChange={(e) => setReason(e.target.value)} style={smallInputStyle}>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            style={{ ...smallInputStyle, width: 140 }}
          />
          <button type="submit" disabled={saving} style={{ ...buttonStyle, minHeight: 32, padding: '0 12px' }}>
            {saving ? '…' : 'Apply'}
          </button>
          {error && (
            <span role="alert" style={{ color: 'var(--mc-status-error)', fontSize: 'var(--mc-type-caption)' }}>
              {error}
            </span>
          )}
        </form>

        {/* A native <dialog> is in the top layer, so it renders over the
            page rather than inside this cell however deeply it is nested. */}
        <ModalDialog
          open={confirmReduce}
          onClose={() => setConfirmReduce(false)}
          labelledBy={reduceTitleId}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h2 id={reduceTitleId} style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
                Take stock down?
              </h2>
              <p style={mutedSmallStyle}>
                {variant.sku} — {variant.colour} / {variant.size}
              </p>
            </div>
            <div style={ruleStyle} />

            <div style={panelStyle}>
              <p style={sectionLabelStyle}>WHAT CHANGES</p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                {variant.stock_quantity} → {resulting}
              </p>
              <p style={mutedSmallStyle}>
                {resulting !== null && resulting < 0
                  ? 'This is more than the variant holds. Stock cannot go below zero, so this will be refused — reduce the amount.'
                  : resulting === 0
                    ? 'That takes it to zero, so it reads Sold out in the shop and cannot be bought.'
                    : 'Customers see the new figure straight away.'}
              </p>
              <p style={mutedSmallStyle}>Reason: {reason}{note ? ` — ${note}` : ''}</p>
            </div>

            <p style={mutedSmallStyle}>
              Recorded twice, and both are permanent: an inventory adjustment against this variant,
              and an audit log entry naming you.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConfirmReduce(false)} style={ghostButtonStyle}>
                Leave it alone
              </button>
              {/* Disabled below zero rather than letting adjust_stock
                  refuse it — the Button component's rule is that a disabled
                  control must always carry text saying what would enable
                  it, and the panel above says exactly that. */}
              <button
                type="button"
                onClick={applyAdjustment}
                disabled={saving || (resulting !== null && resulting < 0)}
                style={resulting !== null && resulting < 0 ? disabledButtonStyle : primaryButtonStyle}
              >
                {saving ? 'Applying…' : 'Apply the reduction'}
              </button>
            </div>
          </div>
        </ModalDialog>
      </Td>
    </tr>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 'var(--mc-space-md)' }}>
      <span
        style={{
          display: 'block',
          fontSize: 'var(--mc-type-caption)',
          color: 'var(--mc-text-muted)',
          marginBottom: 'var(--mc-space-2xs)',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: 'var(--mc-space-xs) var(--mc-space-sm)',
        fontSize: 'var(--mc-type-label)',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: 'var(--mc-text-muted)',
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: 'var(--mc-space-sm)', fontSize: 'var(--mc-type-body)', verticalAlign: 'middle' }}>
      {children}
    </td>
  );
}

const matrixHeadStyle: CSSProperties = {
  padding: '4px 10px',
  fontSize: 'var(--mc-type-caption)',
  color: 'var(--mc-text-muted)',
  textAlign: 'left',
};

const matrixCellStyle: CSSProperties = {
  padding: '4px 10px',
  border: '1px solid var(--mc-border-default)',
  textAlign: 'center',
};

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  border: '1px solid var(--mc-border-control)',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 'var(--mc-type-body)',
  boxSizing: 'border-box',
};

const smallInputStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 32,
  padding: '4px 8px',
  fontSize: 'var(--mc-type-caption)',
};

const buttonStyle: CSSProperties = {
  minHeight: 44,
  padding: '0 var(--mc-space-lg)',
  background: 'var(--mc-action-primary-bg)',
  color: 'var(--mc-action-primary-text)',
  border: 'none',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 'var(--mc-type-body)',
  fontWeight: 600,
  cursor: 'pointer',
};

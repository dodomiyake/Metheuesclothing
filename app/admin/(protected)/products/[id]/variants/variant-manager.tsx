'use client';

import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { formatPence, parsePounds } from '@/lib/money';

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

  async function onAdjustStock(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const amountNumber = Number(amount);
    if (!Number.isInteger(amountNumber) || amountNumber < 0) {
      setError('Enter a whole number.');
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/variants/${variant.id}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, amount: amountNumber, reason, note: note || undefined }),
    });
    setSaving(false);
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
            border: '1px solid var(--mc-border-default)',
            background: active ? '#E4F1E8' : 'var(--mc-mist)',
            color: active ? 'var(--mc-teal)' : 'var(--mc-slate)',
            fontSize: 'var(--mc-type-caption)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
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
  border: '1px solid var(--mc-border-default)',
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

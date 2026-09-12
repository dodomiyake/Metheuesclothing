'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { addToCart } from '@/lib/bag/cart';
import { formatPence } from '@/lib/money';

type Variant = {
  id: string;
  colour: string;
  size: string;
  price_pence: number;
  stock_quantity: number;
  is_active: boolean;
};

/**
 * §8.4's purchase-critical steps 5-9 (colour, size, Find Your Fit, stock
 * state, Add to Bag) and §8.6's add-to-bag confirmation — as an inline
 * confirmation rather than a side panel/bottom sheet, which is the one
 * piece of reduced fidelity here. "Find Your Fit" itself is left out: the
 * size guide would need verified garment measurements, which CLAUDE.md
 * says are placeholders that must not ship (§8.5).
 */
export function AddToBag({
  productSlug,
  productName,
  variants,
}: {
  productSlug: string;
  productName: string;
  variants: Variant[];
}) {
  const colours = useMemo(() => [...new Set(variants.map((v) => v.colour))], [variants]);
  const sizes = useMemo(() => [...new Set(variants.map((v) => v.size))], [variants]);

  const [colour, setColour] = useState<string | null>(colours[0] ?? null);
  const [size, setSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const variantFor = (c: string | null, s: string | null) =>
    variants.find((v) => v.colour === c && v.size === s);

  const selected = variantFor(colour, size);
  const purchasable = variants.filter((v) => v.is_active && v.stock_quantity > 0);

  if (purchasable.length === 0) {
    return (
      <p style={{ fontFamily: 'var(--mc-font-body)', color: 'var(--mc-status-error)', fontWeight: 600 }}>
        Sold out
      </p>
    );
  }

  function onAdd() {
    if (!size) {
      setSizeError(true);
      return;
    }
    const variant = variantFor(colour, size);
    if (!variant || !variant.is_active || variant.stock_quantity < 1) return;

    addToCart({
      variantId: variant.id,
      productSlug,
      productName,
      colour: variant.colour,
      size: variant.size,
      quantity: 1,
      unitPricePence: variant.price_pence,
    });
    setConfirmation(`Added ${productName} — ${variant.colour} / ${variant.size} to your bag.`);
  }

  return (
    <div style={{ fontFamily: 'var(--mc-font-body)' }}>
      {colours.length > 1 && (
        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 var(--mc-space-md)' }}>
          <legend style={legendStyle}>Colour</legend>
          <div style={{ display: 'flex', gap: 'var(--mc-space-2xs)', flexWrap: 'wrap' }}>
            {colours.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColour(c);
                  setSize(null);
                }}
                style={swatchStyle(c === colour)}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset style={{ border: 'none', padding: 0, margin: '0 0 var(--mc-space-md)' }}>
        <legend style={legendStyle}>Size</legend>
        <div style={{ display: 'flex', gap: 'var(--mc-space-2xs)', flexWrap: 'wrap' }}>
          {sizes.map((s) => {
            const variant = variantFor(colour, s);
            const available = Boolean(variant?.is_active && (variant?.stock_quantity ?? 0) > 0);
            return (
              <button
                key={s}
                type="button"
                disabled={!available}
                onClick={() => {
                  setSize(s);
                  setSizeError(false);
                }}
                style={swatchStyle(s === size, !available)}
              >
                {s}
              </button>
            );
          })}
        </div>
        {sizeError && (
          <p role="alert" style={{ color: 'var(--mc-status-error)', fontSize: 'var(--mc-type-caption)' }}>
            Choose a size before adding this T-shirt.
          </p>
        )}
      </fieldset>

      {selected && (
        <p style={{ fontSize: 'var(--mc-type-caption)', color: 'var(--mc-text-muted)' }}>
          {selected.stock_quantity > 0
            ? selected.stock_quantity <= 5
              ? `Only ${selected.stock_quantity} left`
              : 'In stock'
            : 'Out of stock in this size'}
        </p>
      )}

      <button type="button" onClick={onAdd} style={buttonStyle}>
        Add to Bag
      </button>

      {confirmation && (
        <p style={{ marginTop: 'var(--mc-space-sm)', fontSize: 'var(--mc-type-body)' }}>
          {confirmation}{' '}
          <Link href="/bag" style={{ color: 'var(--mc-text-primary)', fontWeight: 600 }}>
            View Bag
          </Link>
        </p>
      )}
    </div>
  );
}

const legendStyle = {
  fontSize: 'var(--mc-type-label)',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  color: 'var(--mc-text-muted)',
  marginBottom: 'var(--mc-space-2xs)',
};

function swatchStyle(active: boolean, disabled = false) {
  return {
    minHeight: 44,
    minWidth: 44,
    padding: '0 var(--mc-space-sm)',
    border: `1px solid ${active ? 'var(--mc-border-strong)' : 'var(--mc-border-default)'}`,
    borderRadius: 'var(--mc-radius-sm)',
    background: active ? 'var(--mc-black)' : 'var(--mc-cream)',
    color: active ? 'var(--mc-cream)' : disabled ? 'var(--mc-text-muted)' : 'var(--mc-text-primary)',
    textDecoration: disabled ? 'line-through' : 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontFamily: 'var(--mc-font-body)',
    fontSize: 'var(--mc-type-body)',
  };
}

const buttonStyle = {
  minHeight: 44,
  padding: '0 var(--mc-space-xl)',
  background: 'var(--mc-action-primary-bg)',
  color: 'var(--mc-action-primary-text)',
  border: 'none',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 'var(--mc-type-body)',
  fontWeight: 600,
  cursor: 'pointer',
};

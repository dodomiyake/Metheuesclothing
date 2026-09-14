'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { addToCart } from '@/lib/bag/cart';
import { formatPence } from '@/lib/money';

type Variant = {
  id: string;
  colour: string;
  size: string;
  price_pence: number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
};

const chipStyle = (state: 'default' | 'selected' | 'disabled'): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  padding: state === 'selected' ? '12.5px 10px 12.5px 16px' : '12.5px 16px',
  gap: 8,
  borderRadius: 'var(--mc-radius-sm)',
  border: `1px solid ${state === 'selected' ? 'var(--mc-border-strong)' : 'var(--mc-border-default)'}`,
  background: state === 'selected' ? 'var(--mc-bg-inverse)' : 'none',
  color: state === 'selected' ? 'var(--mc-text-inverse)' : state === 'disabled' ? 'var(--mc-text-muted)' : 'var(--mc-text-primary)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 14,
  fontWeight: 500,
  cursor: state === 'disabled' ? 'not-allowed' : 'pointer',
});

/**
 * §8.4's purchase-critical steps (colour, size, stock state, Add to Bag) —
 * rebuilt against 04A/B/C (Figma node 60:878/58:783/54:703) rather than the
 * earlier token-styled version: chips match the real Filter Chip component
 * (Default/Selected/Disabled), the sold-out-sizes helper line and stock
 * state are built from real stock_quantity/low_stock_threshold rather than
 * a generic "in stock"/"out of stock" toggle, and a sticky bottom bar
 * (mobile/tablet only, CSS-gated off at 1440px+) appears once this panel's
 * own Add to Bag button scrolls out of view. "Find your fit" stays
 * non-interactive with a tooltip explaining why, the same treatment
 * components/site/header.tsx already gives the inert search icon: a size
 * guide needs verified garment measurements, which CLAUDE.md says are
 * placeholders that must not ship (§8.5). The design's side-panel/bottom-
 * sheet confirmation (§8.6) stays deferred — this is still an inline one.
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
  const [stickyVisible, setStickyVisible] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setStickyVisible(!entry.isIntersecting), {
      rootMargin: '0px 0px -1px 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const variantFor = (c: string | null, s: string | null) => variants.find((v) => v.colour === c && v.size === s);
  const selected = variantFor(colour, size);
  const purchasable = variants.filter((v) => v.is_active && v.stock_quantity > 0);

  const soldOutSizesForColour = colour
    ? sizes.filter((s) => {
        const v = variantFor(colour, s);
        return !v || !v.is_active || v.stock_quantity < 1;
      })
    : [];

  if (purchasable.length === 0) {
    return (
      <p style={{ fontFamily: 'var(--mc-font-body)', color: 'var(--mc-status-error)', fontWeight: 600 }}>Sold out</p>
    );
  }

  function add() {
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

  const stockState = !selected
    ? null
    : selected.stock_quantity <= 0
      ? { colour: 'var(--mc-status-error)', text: 'Out of stock in this size' }
      : selected.stock_quantity <= selected.low_stock_threshold
        ? { colour: 'var(--mc-status-attention)', text: `Low stock — ${selected.stock_quantity} left` }
        : { colour: 'var(--mc-status-success)', text: 'In stock' };

  return (
    <div style={{ fontFamily: 'var(--mc-font-body)', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {colours.length > 1 && (
        <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <legend style={legendStyle}>Colour{colour ? ` — ${colour}` : ''}</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {colours.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColour(c);
                  setSize(null);
                  setSizeError(false);
                }}
                style={chipStyle(c === colour ? 'selected' : 'default')}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <legend style={{ ...legendStyle, flex: 1 }}>Size</legend>
          <span
            title="Size guide coming soon — needs verified garment measurements"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 44,
              padding: '0 24px',
              color: 'var(--mc-text-muted)',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'default',
            }}
          >
            Find your fit
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
                style={chipStyle(s === size ? 'selected' : available ? 'default' : 'disabled')}
              >
                {s}
              </button>
            );
          })}
        </div>
        {soldOutSizesForColour.length > 0 && colour && (
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', lineHeight: 1.5, margin: 0 }}>
            {soldOutSizesForColour.join(' and ')} {soldOutSizesForColour.length > 1 ? 'are' : 'is'} sold out in {colour}.
            Sizes stay visible so you can see the full range.
          </p>
        )}
        {sizeError && (
          <p role="alert" style={{ color: 'var(--mc-status-error)', fontSize: 13, margin: 0 }}>
            Choose a size before adding this T-shirt.
          </p>
        )}
      </fieldset>

      {stockState && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: stockState.colour, flexShrink: 0 }} />
          <p style={{ fontSize: 15, fontWeight: 500, color: stockState.colour, margin: 0 }}>{stockState.text}</p>
        </div>
      )}

      <div ref={sentinelRef}>
        <button
          type="button"
          onClick={add}
          style={{
            width: '100%',
            minHeight: 44,
            padding: '0 24px',
            background: 'var(--mc-action-primary-bg)',
            color: 'var(--mc-action-primary-text)',
            border: 'none',
            borderRadius: 'var(--mc-radius-sm)',
            fontFamily: 'var(--mc-font-body)',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Add to Bag
        </button>
      </div>

      {confirmation && (
        <p style={{ fontSize: 15, margin: 0 }}>
          {confirmation}{' '}
          <Link href="/bag" style={{ color: 'var(--mc-text-primary)', fontWeight: 600 }}>
            View Bag
          </Link>
        </p>
      )}

      <div className="mc-page-gutter mc-pdp-sticky-bar" data-visible={stickyVisible} style={{ paddingTop: 12, paddingBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--mc-text-primary)', margin: 0 }}>
            {selected ? formatPence(selected.price_pence) : formatPence(variants[0]?.price_pence ?? 0)}
          </p>
          <p style={{ fontSize: 12, color: 'var(--mc-text-muted)', margin: 0 }}>
            {colour ?? 'Choose colour'} · {size ? `Size ${size}` : 'Choose size'}
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          style={{
            minHeight: 44,
            padding: '0 24px',
            background: 'var(--mc-action-primary-bg)',
            color: 'var(--mc-action-primary-text)',
            border: 'none',
            borderRadius: 'var(--mc-radius-sm)',
            fontFamily: 'var(--mc-font-body)',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Add to Bag
        </button>
      </div>
    </div>
  );
}

const legendStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '1.54px',
  textTransform: 'uppercase',
  color: 'var(--mc-text-muted)',
  padding: 0,
};

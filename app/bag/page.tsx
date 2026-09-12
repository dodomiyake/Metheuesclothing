'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/bag/use-cart';
import { updateCartQuantity, removeFromCart, type CartLine } from '@/lib/bag/cart';
import { formatPence } from '@/lib/money';
import { createClient } from '@/lib/supabase/public';

/**
 * §8.7 bag + the email/delivery-method half of §8.8 checkout — the rest of
 * checkout (address, payment) is Stripe's hosted page, which is the whole
 * point of using Stripe Checkout, so this page only needs to collect what
 * POST /api/checkout actually asks for.
 *
 * Every price shown here is re-fetched from product_variants on mount, not
 * trusted from the localStorage snapshot — this is still only a display
 * convenience, though: price_cart() on the server is what checkout actually
 * charges, regardless of what this page shows.
 */

type LiveVariant = {
  price_pence: number;
  stock_quantity: number;
  is_active: boolean;
};

export default function BagPage() {
  const cart = useCart();
  const [live, setLive] = useState<Record<string, LiveVariant>>({});
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(15000);
  const [email, setEmail] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'tracked_48' | 'next_day'>('tracked_48');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (cart.length === 0) return;
    const supabase = createClient();
    supabase
      .from('product_variants')
      .select('id, price_pence, stock_quantity, is_active')
      .in(
        'id',
        cart.map((l) => l.variantId),
      )
      .then(({ data }) => {
        const map: Record<string, LiveVariant> = {};
        for (const v of data ?? []) {
          map[v.id] = { price_pence: v.price_pence, stock_quantity: v.stock_quantity, is_active: v.is_active };
        }
        setLive(map);
      });
    supabase
      .from('store_settings')
      .select('free_delivery_threshold_pence')
      .single()
      .then(({ data }) => {
        if (data) setFreeDeliveryThreshold(data.free_delivery_threshold_pence);
      });
  }, [cart.length]);

  function priceFor(line: CartLine) {
    return live[line.variantId]?.price_pence ?? line.unitPricePence;
  }

  const subtotal = cart.reduce((sum, l) => sum + priceFor(l) * l.quantity, 0);
  const deliveryPence =
    deliveryMethod === 'next_day' ? 695 : subtotal >= freeDeliveryThreshold ? 0 : 395;
  const total = subtotal + deliveryPence;

  async function onCheckout() {
    setError(null);
    if (!email) {
      setError('Enter your email to continue.');
      return;
    }
    const unavailable = cart.find((l) => {
      const v = live[l.variantId];
      return v && (!v.is_active || v.stock_quantity < l.quantity);
    });
    if (unavailable) {
      setError(`${unavailable.productName} (${unavailable.colour} / ${unavailable.size}) is no longer available in that quantity.`);
      return;
    }

    setSubmitting(true);
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
        email,
        delivery_method: deliveryMethod,
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not start checkout. Please try again.');
      return;
    }
    const body = await res.json();
    window.location.href = body.url;
  }

  if (cart.length === 0) {
    return (
      <main style={{ padding: 'var(--mc-space-xl) var(--mc-gutter-desktop)', fontFamily: 'var(--mc-font-body)' }}>
        <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)' }}>Bag</h1>
        <p style={{ color: 'var(--mc-text-muted)' }}>
          Your bag is empty. <Link href="/shop" style={{ color: 'var(--mc-text-primary)' }}>Continue shopping</Link>.
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: 'var(--mc-space-xl) var(--mc-gutter-desktop)',
        fontFamily: 'var(--mc-font-body)',
        maxWidth: 720,
      }}
    >
      <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)' }}>Bag</h1>

      {cart.map((line) => {
        const price = priceFor(line);
        const v = live[line.variantId];
        return (
          <div
            key={line.variantId}
            style={{
              display: 'flex',
              gap: 'var(--mc-space-md)',
              padding: 'var(--mc-space-md) 0',
              borderBottom: '1px solid var(--mc-border-default)',
            }}
          >
            <div
              style={{
                width: 72,
                aspectRatio: '4 / 5',
                background: 'var(--mc-sand)',
                borderRadius: 'var(--mc-radius-sm)',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{line.productName}</div>
              <div style={{ fontSize: 'var(--mc-type-caption)', color: 'var(--mc-text-muted)' }}>
                {line.colour} / {line.size}
              </div>
              {v && (!v.is_active || v.stock_quantity < line.quantity) && (
                <div style={{ fontSize: 'var(--mc-type-caption)', color: 'var(--mc-status-error)' }}>
                  {v.is_active ? `Only ${v.stock_quantity} left` : 'No longer available'}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--mc-space-sm)', marginTop: 'var(--mc-space-2xs)' }}>
                <label>
                  <span style={{ fontSize: 'var(--mc-type-caption)', color: 'var(--mc-text-muted)', marginRight: 6 }}>
                    Qty
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={line.quantity}
                    onChange={(e) => updateCartQuantity(line.variantId, Math.max(1, Number(e.target.value) || 1))}
                    style={{ width: 56, minHeight: 36, padding: '2px 6px' }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeFromCart(line.variantId)}
                  style={{ background: 'none', border: 'none', color: 'var(--mc-text-muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: 'var(--mc-type-caption)' }}
                >
                  Remove
                </button>
              </div>
            </div>
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <div>{formatPence(price * line.quantity)}</div>
              <div style={{ fontSize: 'var(--mc-type-caption)', color: 'var(--mc-text-muted)' }}>
                {formatPence(price)} each
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 'var(--mc-space-lg)' }}>
        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 var(--mc-space-md)' }}>
          <legend style={{ fontSize: 'var(--mc-type-label)', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--mc-text-muted)' }}>
            Delivery
          </legend>
          <label style={{ display: 'block', marginBottom: 4 }}>
            <input
              type="radio"
              checked={deliveryMethod === 'tracked_48'}
              onChange={() => setDeliveryMethod('tracked_48')}
            />{' '}
            Tracked 48 — {subtotal >= freeDeliveryThreshold ? 'Free' : formatPence(395)}
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="radio"
              checked={deliveryMethod === 'next_day'}
              onChange={() => setDeliveryMethod('next_day')}
            />{' '}
            Next working day — {formatPence(695)}
          </label>
        </fieldset>

        <label style={{ display: 'block', marginBottom: 'var(--mc-space-md)' }}>
          <span style={{ display: 'block', fontSize: 'var(--mc-type-caption)', color: 'var(--mc-text-muted)', marginBottom: 4 }}>
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: '100%', minHeight: 44, padding: '10px 12px', border: '1px solid var(--mc-border-default)', borderRadius: 'var(--mc-radius-sm)', boxSizing: 'border-box' }}
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--mc-type-caption)', color: 'var(--mc-text-muted)' }}>
          <span>Subtotal</span>
          <span>{formatPence(subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--mc-type-caption)', color: 'var(--mc-text-muted)' }}>
          <span>Delivery</span>
          <span>{deliveryPence === 0 ? 'Free' : formatPence(deliveryPence)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 'var(--mc-type-subhead)', marginTop: 'var(--mc-space-2xs)' }}>
          <span>Total</span>
          <span>{formatPence(total)}</span>
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--mc-status-error)', marginTop: 'var(--mc-space-sm)' }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onCheckout}
          disabled={submitting}
          style={{
            width: '100%',
            minHeight: 44,
            marginTop: 'var(--mc-space-md)',
            background: 'var(--mc-action-primary-bg)',
            color: 'var(--mc-action-primary-text)',
            border: 'none',
            borderRadius: 'var(--mc-radius-sm)',
            fontFamily: 'var(--mc-font-body)',
            fontSize: 'var(--mc-type-body)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {submitting ? 'Starting checkout…' : 'Secure Checkout'}
        </button>
      </div>
    </main>
  );
}

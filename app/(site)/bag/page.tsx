'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/bag/use-cart';
import { updateCartQuantity, removeFromCart, type CartLine } from '@/lib/bag/cart';
import { formatPence } from '@/lib/money';
import { createClient } from '@/lib/supabase/public';

/**
 * §8.7 bag + the email/delivery-method half of §8.8 checkout — rebuilt
 * against the real screens (05A/B/C, Figma node 72:1215/69:1101/65:993)
 * rather than the earlier token-styled MVP: a real Quantity Control
 * stepper instead of a number input, Ghost/Secondary/Primary buttons
 * matching the real Button component, and the desktop-only "N T-shirts" /
 * Estimated VAT row / delivery-banner Continue-shopping placement that
 * only Desktop actually shows.
 *
 * Two disclosed deviations from what's pulled, not oversights:
 * - None of the three screens show an email field — Stripe Checkout could
 *   collect it instead, but that would mean orders.email isn't known
 *   until the webhook fires, which ripples into guest order lookup (rule
 *   5) and the order-confirmation email. That's a real architecture
 *   question for the owner, not something to infer from one screen's
 *   omission, so the field stays exactly where it already worked.
 * - None of the three screens show a next-day delivery choice, only a
 *   flat qualifying-or-not banner. Next-day is a real, working, priced
 *   option the checkout API already supports (delivery_method), so it
 *   stays as a compact opt-in near the delivery banner rather than being
 *   deleted to match a screen that simply doesn't depict that state.
 * The delivery banner itself also drops the design's "Tracked with DPD,
 * 2–4 working days" line — real delivery rates and carrier are on
 * CLAUDE.md's blocked-on-owner list, the same reason product detail's
 * spec section omits its Estimate/Carrier rows.
 */

type LiveVariant = {
  price_pence: number;
  stock_quantity: number;
  is_active: boolean;
};

const MAX_QTY = 10;

/**
 * `includeDisplay: false` for the two "Continue shopping" instances that a
 * CSS class (.mc-bag-continue-desktop / .mc-bag-continue-aside) toggles
 * display:none/flex on per breakpoint -- an inline `display` always beats
 * a stylesheet rule regardless of selector, so setting one here would
 * silently defeat that toggle and show both copies at every width.
 */
const buttonStyle = (
  style: 'primary' | 'secondary' | 'ghost',
  fullWidth = false,
  includeDisplay = true,
): React.CSSProperties => ({
  ...(includeDisplay ? { display: 'inline-flex' } : {}),
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  width: fullWidth ? '100%' : undefined,
  padding: '0 24px',
  borderRadius: 'var(--mc-radius-sm)',
  border: style === 'secondary' ? '1px solid var(--mc-border-strong)' : 'none',
  background: style === 'primary' ? 'var(--mc-action-primary-bg)' : 'none',
  color: style === 'primary' ? 'var(--mc-action-primary-text)' : 'var(--mc-text-primary)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: '0.32px',
  cursor: 'pointer',
  textDecoration: 'none',
  boxSizing: 'border-box',
});

const stepStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
};

export default function BagPage() {
  const cart = useCart();
  const [live, setLive] = useState<Record<string, LiveVariant>>({});
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(15000);
  const [email, setEmail] = useState('');
  const [nextDay, setNextDay] = useState(false);
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
  const totalQuantity = cart.reduce((sum, l) => sum + l.quantity, 0);
  const qualifiesForFreeDelivery = subtotal >= freeDeliveryThreshold;
  const deliveryPence = nextDay ? 695 : qualifiesForFreeDelivery ? 0 : 395;
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
        delivery_method: nextDay ? 'next_day' : 'tracked_48',
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
      <main className="mc-page-gutter" style={{ paddingTop: 'var(--mc-space-xl)', paddingBottom: 'var(--mc-space-xl)', fontFamily: 'var(--mc-font-body)' }}>
        <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)', margin: 0 }}>Your Bag</h1>
        <p style={{ color: 'var(--mc-text-muted)', marginTop: 'var(--mc-space-sm)' }}>
          Your bag is empty.{' '}
          <Link href="/shop" style={{ color: 'var(--mc-text-primary)', fontWeight: 600 }}>
            Continue shopping
          </Link>
          .
        </p>
      </main>
    );
  }

  const deliveryMessage = qualifiesForFreeDelivery
    ? 'You have qualified for free UK delivery.'
    : `Add ${formatPence(freeDeliveryThreshold - subtotal)} more to qualify for free UK delivery.`;

  return (
    <main style={{ fontFamily: 'var(--mc-font-body)' }}>
      <div className="mc-page-gutter" style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 'var(--mc-space-xl)', paddingBottom: 'var(--mc-space-md)' }}>
        <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)', margin: 0 }}>Your Bag</h1>
        <p style={{ fontSize: 16, color: 'var(--mc-text-muted)', margin: 0 }}>
          {cart.length} item{cart.length === 1 ? '' : 's'}
          <span className="mc-bag-tshirt-count">
            {' '}
            · {totalQuantity} T-shirt{totalQuantity === 1 ? '' : 's'}
          </span>
        </p>
      </div>

      <div className="mc-page-gutter mc-bag-layout" style={{ paddingBottom: 80 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {cart.map((line) => {
            const price = priceFor(line);
            const v = live[line.variantId];
            return <BagLineRow key={line.variantId} line={line} price={price} unavailable={v && (!v.is_active || v.stock_quantity < line.quantity)} live={v} />;
          })}

          <div
            style={{
              background: 'var(--mc-bg-surface)',
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              padding: '20px 24px',
              marginTop: cart.length ? 0 : undefined,
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.54px', textTransform: 'uppercase', color: 'var(--mc-text-muted)', margin: 0 }}>
                Delivery
              </p>
              <p style={{ fontSize: 15, lineHeight: 1.55, margin: 0 }}>{deliveryMessage}</p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--mc-text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={nextDay} onChange={(e) => setNextDay(e.target.checked)} />
                Next working day instead — {formatPence(695)}
              </label>
            </div>
            <Link href="/shop" className="mc-bag-continue-desktop" style={buttonStyle('ghost', false, false)}>
              Continue shopping
            </Link>
          </div>
        </div>

        <aside className="mc-bag-summary" style={{ background: 'var(--mc-bg-surface)', border: '1px solid var(--mc-border-default)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, boxSizing: 'border-box' }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.54px', textTransform: 'uppercase', color: 'var(--mc-text-muted)', margin: 0 }}>
            Order summary
          </p>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <SummaryRow label="Subtotal" value={formatPence(subtotal)} />
            <SummaryRow label="Delivery" value={deliveryPence === 0 ? 'Free' : formatPence(deliveryPence)} />
            <div className="mc-bag-vat-row">
              <SummaryRow label="Estimated VAT" value="Included" />
            </div>
            <SummaryRow label="Total" value={formatPence(total)} big noBorder />
          </div>

          <label style={{ display: 'block', width: '100%' }}>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--mc-text-muted)', marginBottom: 4 }}>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ width: '100%', minHeight: 44, padding: '10px 12px', border: '1px solid var(--mc-border-default)', borderRadius: 'var(--mc-radius-sm)', boxSizing: 'border-box', fontFamily: 'var(--mc-font-body)', fontSize: 15 }}
            />
          </label>

          {error && (
            <p role="alert" style={{ color: 'var(--mc-status-error)', fontSize: 13, margin: 0 }}>
              {error}
            </p>
          )}

          <button type="button" onClick={onCheckout} disabled={submitting} style={buttonStyle('primary', true)}>
            {submitting ? 'Starting checkout…' : 'Secure Checkout'}
          </button>
          <Link href="/shop" className="mc-bag-continue-aside" style={buttonStyle('secondary', true, false)}>
            Continue shopping
          </Link>

          <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--mc-text-muted)', margin: 0 }}>
            Includes UK VAT. Prices and stock are confirmed on the server before payment. Guest checkout available —
            no account required. Payments handled securely by Stripe.
          </p>
        </aside>
      </div>
    </main>
  );
}

function BagLineRow({
  line,
  price,
  unavailable,
  live,
}: {
  line: CartLine;
  price: number;
  unavailable: boolean | undefined;
  live: LiveVariant | undefined;
}) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '20px 0', borderBottom: '1px solid var(--mc-border-default)' }}>
      <div style={{ width: 88, aspectRatio: '4 / 5', background: 'var(--mc-sand)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>{line.productName}</p>
            <p style={{ fontSize: 14, color: 'var(--mc-text-muted)', margin: 0 }}>
              {line.colour} · Size {line.size}
            </p>
          </div>
          <p style={{ fontSize: 16, fontWeight: 500, margin: 0, whiteSpace: 'nowrap' }}>{formatPence(price * line.quantity)}</p>
        </div>
        <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>{formatPence(price)} each</p>

        {unavailable && (
          <p style={{ fontSize: 13, color: 'var(--mc-status-error)', margin: 0 }}>
            {live && !live.is_active ? 'No longer available' : `Only ${live?.stock_quantity ?? 0} left`}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <QuantityControl
            quantity={line.quantity}
            onChange={(q) => updateCartQuantity(line.variantId, q)}
          />
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => removeFromCart(line.variantId)} style={buttonStyle('ghost')}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function QuantityControl({ quantity, onChange }: { quantity: number; onChange: (q: number) => void }) {
  const canDecrease = quantity > 1;
  const canIncrease = quantity < MAX_QTY;
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--mc-border-default)', borderRadius: 'var(--mc-radius-sm)' }}>
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={!canDecrease}
        onClick={() => onChange(quantity - 1)}
        style={{ ...stepStyle, cursor: canDecrease ? 'pointer' : 'not-allowed', color: canDecrease ? 'var(--mc-text-primary)' : 'var(--mc-text-muted)' }}
      >
        <svg width="13" height="2" viewBox="0 0 13 2" aria-hidden>
          <rect width="13" height="1.25" fill="currentColor" />
        </svg>
      </button>
      <div style={{ width: 36, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 500 }}>{quantity}</span>
      </div>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={!canIncrease}
        onClick={() => onChange(quantity + 1)}
        style={{ ...stepStyle, cursor: canIncrease ? 'pointer' : 'not-allowed', color: canIncrease ? 'var(--mc-text-primary)' : 'var(--mc-text-muted)' }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
          <rect y="5.5" width="13" height="1.25" fill="currentColor" />
          <rect x="5.5" width="1.25" height="13" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}

function SummaryRow({ label, value, big, noBorder }: { label: string; value: string; big?: boolean; noBorder?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '13px 0',
        borderBottom: noBorder ? 'none' : '1px solid var(--mc-border-default)',
        fontSize: big ? 18 : 15,
        fontWeight: big ? 500 : 400,
      }}
    >
      <span>{label}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

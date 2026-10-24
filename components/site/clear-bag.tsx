'use client';

import { useEffect } from 'react';
import { clearCart, getCart } from '@/lib/bag/cart';

/**
 * Empties the bag when someone lands on an order confirmation.
 *
 * `clearCart()` has existed in lib/bag/cart.ts since the bag was built and
 * NOTHING EVER CALLED IT, so the bag survived checkout: the thank-you page
 * showed "5" in the header, /bag still listed everything that had just been
 * paid for, and checking out again would have created a second order for
 * the same T-shirts. That is the worst failure available here — not a stale
 * badge but a customer paying twice — which is why it is cleared even
 * though the design file draws nothing about it.
 *
 * WHY HERE RATHER THAN THE BAG PAGE. Stripe's success_url lands on this
 * route (app/api/checkout/route.ts), so this is the first moment the
 * browser is back under our control after a completed payment. Clearing
 * before the redirect would empty the bag of anyone who reaches Stripe and
 * changes their mind — cancel_url comes straight back to /bag, and finding
 * it empty is the one thing guaranteed to lose the sale.
 *
 * WHY A LIST OF ORDER NUMBERS. This page is reachable by typing a URL, and
 * order numbers are sequential by design (see the page's own comment). A
 * bare "clear on mount" would empty a bag that has since been refilled
 * every time someone opened an old confirmation from their history or hit
 * back. Remembering which orders have already been cleared for means each
 * one clears exactly once. The list is capped because it is a guard, not a
 * record — and it is NOT the order history, which lives in the database.
 *
 * The trade-off left standing: someone who opens a confirmation for an
 * order they never placed loses their own bag. It is their own browser,
 * it affects nobody else, and the alternative is a bag that keeps items
 * already bought.
 */
const CLEARED_KEY = 'mc-bag-cleared-for';
const KEEP = 20;

export function ClearBagOnConfirmation({ orderNumber }: { orderNumber: string }) {
  useEffect(() => {
    // Read the guard on its own, so corrupt JSON falls back to "nothing has
    // been cleared yet" rather than disabling clearing for good.
    let cleared: string[] = [];
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(CLEARED_KEY) ?? '[]');
      if (Array.isArray(parsed)) cleared = parsed.filter((v): v is string => typeof v === 'string');
    } catch {
      cleared = [];
    }

    if (cleared.includes(orderNumber)) return;

    try {
      // Only touch the cart when there is something in it, so an empty bag
      // does not dispatch a change event nobody needs.
      if (getCart().length > 0) clearCart();

      // Recorded even when the bag was already empty. The guard answers
      // "has this order had its turn", not "did it remove anything" — a
      // confirmation opened once with an empty bag must not come back and
      // empty a bag refilled since.
      window.localStorage.setItem(CLEARED_KEY, JSON.stringify([orderNumber, ...cleared].slice(0, KEEP)));
    } catch {
      // Private browsing, or storage disabled. Nothing persisted, and
      // nothing to clear — the same shape readCart() already tolerates.
    }
  }, [orderNumber]);

  return null;
}

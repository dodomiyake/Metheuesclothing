'use client';

/**
 * The bag has no server-side persistence yet (§8.7's full design — a bag
 * that survives across devices — is a later step). localStorage is enough
 * for "add on the product page, review and check out in this browser," and
 * nothing here is trusted for money: this only holds display data. Every
 * price is re-derived from the database at checkout by price_cart(), which
 * is the one place §12 lets a price come from.
 */

export type CartLine = {
  variantId: string;
  productSlug: string;
  productName: string;
  colour: string;
  size: string;
  quantity: number;
  /** Snapshot for display only — checkout reprices from the database. */
  unitPricePence: number;
};

const STORAGE_KEY = 'mc-bag';
const CART_EVENT = 'mc-bag-changed';

function readCart(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(lines: CartLine[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function addToCart(line: CartLine) {
  const lines = readCart();
  const existing = lines.find((l) => l.variantId === line.variantId);
  if (existing) {
    existing.quantity += line.quantity;
  } else {
    lines.push(line);
  }
  writeCart(lines);
}

export function updateCartQuantity(variantId: string, quantity: number) {
  const lines = readCart().filter((l) => l.variantId !== variantId || quantity > 0);
  const target = lines.find((l) => l.variantId === variantId);
  if (target) target.quantity = quantity;
  writeCart(lines);
}

export function removeFromCart(variantId: string) {
  writeCart(readCart().filter((l) => l.variantId !== variantId));
}

export function clearCart() {
  writeCart([]);
}

export { readCart as getCart, STORAGE_KEY, CART_EVENT };

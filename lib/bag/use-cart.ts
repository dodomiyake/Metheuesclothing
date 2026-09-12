'use client';

import { useEffect, useState } from 'react';
import { getCart, CART_EVENT, type CartLine } from './cart';

/** Re-reads localStorage on mount and whenever any component in this tab
 * changes the cart (cart.ts dispatches CART_EVENT after every write). */
export function useCart(): CartLine[] {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    setLines(getCart());
    const onChange = () => setLines(getCart());
    window.addEventListener(CART_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(CART_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  return lines;
}

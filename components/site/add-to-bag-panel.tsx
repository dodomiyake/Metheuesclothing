'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { formatPence } from '@/lib/money';
import { useCart } from '@/lib/bag/use-cart';
import { updateCartQuantity, removeFromCart } from '@/lib/bag/cart';
import { QuantityControl } from './quantity-control';

/**
 * 05G/H/I Add to Bag confirmation — Figma 75:1580 (Desktop drawer, 420
 * wide and full height), 75:1660 (Tablet sheet, 480) and 75:1740 (Mobile
 * sheet, full width). All three pulled or measured; the three frames are
 * the SAME content at three gutters (24/24/20), differing only in where
 * the panel is anchored.
 *
 * §8.6 lists five things that must happen after adding a variant. "Update
 * the bag count" went in with the header badge; this is the other four —
 * confirm product, colour, size, quantity and price; open a side panel on
 * desktop or a bottom sheet on mobile; offer View Bag and Continue
 * shopping; and never force navigation to the bag. Until now the product
 * page answered with one line of text, which add-to-bag.tsx's own comment
 * described as the stand-in it was.
 *
 * A NATIVE <dialog> opened with showModal(), the same choice
 * components/admin/modal-dialog.tsx records: it brings the focus trap, the
 * inert background, Escape and ::backdrop without re-implementing any of
 * them. Escape and the backdrop both close it, which is safe here because
 * nothing is pending — the line is already in the bag, and closing is
 * exactly what "Continue shopping" does.
 *
 * THE PANEL READS THE LIVE CART rather than the line it was opened with,
 * so the stepper, the subtotal and the item count are the same numbers
 * /bag would show. Adding the same variant twice therefore opens the panel
 * showing quantity 2, not two panels each claiming 1.
 *
 * Removing the line closes the panel: a confirmation whose subject has
 * been deleted has nothing left to confirm, and the design draws no empty
 * state for it.
 */
export type CrossSellItem = {
  slug: string;
  name: string;
  image: { url: string; alt: string } | null;
  pricePence: number;
  /** Derived in the server component — see the product page. */
  note: string;
};

export function AddToBagPanel({
  variantId,
  productName,
  colour,
  size,
  unitPricePence,
  image,
  crossSell,
  onClose,
}: {
  variantId: string;
  productName: string;
  colour: string;
  size: string;
  unitPricePence: number;
  image: { url: string; alt: string } | null;
  crossSell: CrossSellItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cart = useCart();

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  const line = cart.find((l) => l.variantId === variantId);
  const quantity = line?.quantity ?? 0;

  // The subtotal and count are the whole bag's, which is what the frames'
  // "Bag subtotal · 4 items" means beside a single added line.
  const subtotal = cart.reduce((sum, l) => sum + l.unitPricePence * l.quantity, 0);
  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  // The line can disappear underneath us — Remove here, or another tab
  // emptying the bag (useCart listens for `storage` too).
  useEffect(() => {
    if (quantity === 0) onClose();
  }, [quantity, onClose]);
  if (quantity === 0) return null;

  return (
    <dialog
      ref={ref}
      className="mc-bag-panel"
      aria-labelledby="mc-bag-panel-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // The backdrop is the dialog's own box outside the content, so a
      // click that lands on the element itself (not a child) is a
      // backdrop click.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="mc-bag-panel-head">
        <p id="mc-bag-panel-title" className="mc-bag-panel-title">
          <svg width="12" height="9" viewBox="0 0 12 9" aria-hidden>
            <path d="M1 4.5 4.3 8 11 1" fill="none" stroke="currentColor" strokeWidth="1.75" />
          </svg>
          Added to your bag
        </p>
        <button type="button" className="mc-icon-button" aria-label="Close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M1 1l14 14M15 1L1 15" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>

      <div className="mc-bag-panel-body">
        {/* The real Bag Line Item (64:2): 88x110 photograph, name over
            colour and size, line subtotal right, unit price under, then
            the stepper and Remove. */}
        <div className="mc-bag-panel-line">
          <div className="mc-bag-panel-thumb">
            {image ? <img src={image.url} alt={image.alt} /> : null}
          </div>
          <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>{productName}</p>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--mc-text-muted)' }}>
                  {colour} · Size {size}
                </p>
              </div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 500, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {formatPence(unitPricePence * quantity)}
              </p>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--mc-text-muted)' }}>
              {formatPence(unitPricePence)} each
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <QuantityControl
                quantity={quantity}
                onChange={(q) => updateCartQuantity(variantId, q)}
              />
              <span style={{ flex: '1 0 0' }} />
              <button type="button" className="mc-button-ghost" onClick={() => removeFromCart(variantId)}>
                Remove
              </button>
            </div>
          </div>
        </div>

        <div className="mc-bag-panel-total">
          <span style={{ flex: '1 0 0', fontSize: 14, color: 'var(--mc-text-muted)' }}>
            Bag subtotal · {itemCount} item{itemCount === 1 ? '' : 's'}
          </span>
          <span style={{ fontSize: 16, fontWeight: 500, whiteSpace: 'nowrap' }}>{formatPence(subtotal)}</span>
        </div>

        <div className="mc-bag-panel-actions">
          <Link href="/bag" className="mc-button-primary">
            View Bag
          </Link>
          {/* Not a link. §8.6's last bullet is "do not force immediate
              navigation to the bag", and the ledger's note on these frames
              says the panel "never navigates away" — so continuing just
              closes it and leaves the page where it was. */}
          <button type="button" className="mc-button-secondary" onClick={onClose}>
            Continue shopping
          </button>
        </div>
      </div>

      {crossSell.length > 0 && (
        <div className="mc-bag-panel-cross">
          <p className="mc-home-eyebrow">You may also like</p>
          <div>
            {crossSell.map((item) => (
              <Link key={item.slug} href={`/shop/${item.slug}`} className="mc-bag-panel-cross-row">
                <span className="mc-bag-panel-cross-thumb">
                  {item.image ? <img src={item.image.url} alt={item.image.alt} /> : null}
                </span>
                <span style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{item.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--mc-text-muted)' }}>{item.note}</span>
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {formatPence(item.pricePence)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </dialog>
  );
}

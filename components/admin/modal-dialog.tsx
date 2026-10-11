'use client';

import { useEffect, useRef } from 'react';

/**
 * The scrim-and-card shell A15 and A16 are both drawn as (141:1910/141:1734
 * and 141:1967/141:1791). Both frames put a 620px card — 600 on tablet — on
 * a full-bleed black ground, which is a modal, not the inline panel A14 uses
 * inside A12's Tracking card.
 *
 * It is a native <dialog> opened with showModal(), which is what gets the
 * focus trap, the inert background, the Escape key and the ::backdrop
 * without re-implementing any of them. Hand-rolled overlays in this codebase
 * would be a fourth thing to keep accessible, and these two screens are the
 * ones where a keyboard user being dumped behind the scrim matters most.
 *
 * Escape closes it. That is safe here because nothing is submitted until the
 * typed confirmation matches and the button is pressed — closing loses a
 * half-filled form, not an action.
 */
export function ModalDialog({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className="mc-admin-dialog"
      aria-labelledby={labelledBy}
      // Esc fires `cancel`, the backdrop-click path fires `close`; both land
      // here so React state and the element's own state cannot drift apart.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      {children}
    </dialog>
  );
}

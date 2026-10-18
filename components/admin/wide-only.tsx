/**
 * Wraps an admin editing screen that Figma never drew below 768.
 *
 * THE DECISION IS RECORDED, and this comment used to say it was not.
 * design-system-state.json's `admin_breakpoint_decision` carries it, taken
 * by the owner on 10 September: "Admin screens are built at 1440 and 768
 * only. 390 is added ONLY for the handful that are genuinely phone jobs:
 * Dashboard, Orders table, Order detail, Returns queue (plus Admin Sign In,
 * T-shirts and Inventory, already built and kept)." Sixteen screens are
 * listed as no_mobile: A04, A05, A06, A08, A09, A10, A13, A14, A15, A16,
 * A18, A19, A20, A21, A22, A23.
 *
 * The recorded REASON is not quite the read-vs-write line this file used to
 * infer from counting frames. It is density: "Dense tables and multi-section
 * editors fight a 390px screen; the T-shirt editor alone has eleven
 * sections. Phone versions of all 23 would cost real time and produce
 * screens nobody maintains." That matters, because it is a statement about
 * what the DESIGN covers rather than a prohibition on a page working at
 * 390px. Two screens on the no_mobile list are built to work there anyway
 * and say why in their own files — A19 Customers and A23 Audit log, both of
 * which are a stacking list rather than a dense form, and both of which you
 * reach for precisely when you are away from a desk.
 *
 * A05 Product images was the third, and the owner lifted it explicitly on
 * 18 October: the photographs are ON the phone, so gating the screen whose
 * input lives on the device you are holding defeats its purpose. The
 * exception is recorded in the ledger beside the rule, not only here.
 *
 * This wrapper is for the other kind: multi-section editors and
 * consequential actions. Monitor from a phone, operate from a bigger screen.
 *
 * Rendering an undesigned form at 390px anyway is the worse option: these
 * screens adjust stock and will soon issue refunds, and a squashed layout
 * nobody checked is how someone fat-thumbs a number into the wrong field.
 * Saying so costs one sentence.
 *
 * Both branches are in the DOM and swapped by CSS, because a media query
 * cannot change content and a JS width check would flash the wrong one on
 * first paint.
 */
export function WideOnly({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mc-admin-wide-only">{children}</div>
      <div className="mc-admin-narrow-notice">
        <div className="mc-admin-content">
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
            {title}
          </h1>
          <p style={{ fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)', margin: 0 }}>
            This screen was designed for a tablet or a desktop, and it changes real data — stock
            levels, prices, what customers can buy. Open it on a wider screen rather than a layout
            nobody checked at this size.
          </p>
          <p style={{ fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)', margin: 0 }}>
            Orders, inventory and the T-shirt list all read fine on a phone.
          </p>
        </div>
      </div>
    </>
  );
}

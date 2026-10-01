/**
 * Wraps an admin editing screen that Figma never drew below 768.
 *
 * The design file is explicit about this once you count it: of 23 admin
 * screens, 7 have a Mobile frame and 16 do not, and the line between them is
 * almost exactly read vs write. Sign-in, the dashboard, the three queues and
 * Order details get a phone layout; every editor, every settings screen and
 * every consequential action — A04 Edit T-shirt, A06 Generate variants, A08
 * Adjust stock, A13 Fulfilment, A14 Add tracking, A15 Cancel, A16 Refund —
 * is Desktop and Tablet only. Monitor from a phone, operate from a bigger
 * screen.
 *
 * (That rationale is read off which frames exist; no decision to this effect
 * is recorded in design-system-state.json, so it is worth confirming with the
 * design owner rather than treating as settled.)
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

/**
 * Status Badge — Figma component set 125:26, used by A11 Orders, A12 Order
 * details and A17 Returns queue.
 *
 * A white pill with a border, a 7px tone dot and ink text. The dot is
 * supporting information only: the WORD carries the meaning, so the badge
 * still reads with colour removed (CLAUDE.md rule 8, and the component's own
 * description says the same). An earlier ad-hoc badge in the admin products
 * table tinted the whole pill instead, which is not what the component does
 * and which made the tone, rather than the label, the thing you read.
 *
 * The five tones are bound to real semantic variables in Figma; these are
 * the same tokens, read off the component rather than guessed:
 *   Success   Status/Success Teal        --mc-status-success
 *   Attention Semantic/status/attention  --mc-status-attention
 *   Danger    Status/Error Crimson       --mc-status-error
 *   Neutral   Text/Supporting Slate      --mc-text-muted
 *   Info      Primary/Metheues Ink       --mc-text-primary
 */
export type BadgeTone = 'success' | 'attention' | 'danger' | 'neutral' | 'info';

const DOT: Record<BadgeTone, string> = {
  success: 'var(--mc-status-success)',
  attention: 'var(--mc-status-attention)',
  danger: 'var(--mc-status-error)',
  neutral: 'var(--mc-text-muted)',
  info: 'var(--mc-text-primary)',
};

export function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 10px',
        borderRadius: 999,
        background: 'var(--mc-bg-surface)',
        border: '1px solid var(--mc-border-default)',
        fontFamily: 'var(--mc-font-body)',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--mc-text-primary)',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{ width: 7, height: 7, borderRadius: '50%', background: DOT[tone], flexShrink: 0 }}
      />
      {label}
    </span>
  );
}

/** payment_status (001_schema.sql:16). The design draws Paid, Refunded and
 * Failed; `pending` and `partially_refunded` are real enum values it never
 * depicts, so they get labels here rather than rendering blank. */
export const PAYMENT_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pending', tone: 'attention' },
  paid: { label: 'Paid', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  partially_refunded: { label: 'Part refunded', tone: 'neutral' },
};

/**
 * fulfilment_status (001_schema.sql:17).
 *
 * `packed` is labelled "Packed", NOT the design's "To pack". The design has
 * six fulfilment labels for six enum values, and five of them line up — this
 * one does not: "To pack" reads as *awaiting* packing, while the enum value
 * means packing is DONE and the parcel is waiting to ship. Printing "To
 * pack" against an already-packed order would send someone to re-pack it.
 * Worth confirming with the design owner which way round they meant, the
 * same way the E7-vs-"Return approved" naming in design-system-state.json
 * needs settling — but until then the schema's meaning wins, because this
 * one has a physical consequence in a stockroom.
 */
export const FULFILMENT_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  not_started: { label: 'Not started', tone: 'neutral' },
  processing: { label: 'Preparing', tone: 'info' },
  packed: { label: 'Packed', tone: 'attention' },
  shipped: { label: 'Shipped', tone: 'success' },
  delivered: { label: 'Delivered', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

/** Fulfilment states that still need someone to do something. Drives both
 * the rail count and the "N awaiting fulfilment" line on A11. */
export const AWAITING_FULFILMENT = ['not_started', 'processing', 'packed'] as const;

/**
 * return_status (001_schema.sql:18), for A17's STATUS column.
 *
 * Seven enum values against the design's five drawn rows, so two needed
 * labels of their own:
 *
 *  - `label_issued` is drawn nowhere. It sits between "requested" and "on
 *    its way", and nothing in this codebase issues a label yet (the E6
 *    template says a human follows up with instructions, because no return
 *    address is configured anywhere), so it would be odd to omit the one
 *    state that says a label exists.
 *  - `approved` is the important one, and the design's own decision list is
 *    why it cannot say "Approved" and stop there: "E7 sends when the refund
 *    has actually left (A16), not on approval (A18) — approval and refund
 *    are separate events in the admin." An approved return still owes the
 *    customer money, so it reads as unfinished work rather than a result.
 *
 * `requested` is the one label the design makes dynamic — "Waiting 3 days" —
 * so it is built by returnBadge() below rather than stored here.
 */
export const RETURN_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  requested: { label: 'Waiting', tone: 'attention' },
  label_issued: { label: 'Label issued', tone: 'info' },
  in_transit: { label: 'On its way to us', tone: 'info' },
  received: { label: 'Received — check it', tone: 'attention' },
  approved: { label: 'Approved — refund owed', tone: 'attention' },
  rejected: { label: 'Rejected', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'success' },
};

/** The design's "Waiting 3 days" is a real age, not a label. Everything else
 * is the map above. */
export function returnBadge(
  status: string,
  requestedAt: string,
): { label: string; tone: BadgeTone } {
  const entry = RETURN_BADGE[status] ?? { label: status, tone: 'neutral' as const };
  if (status !== 'requested') return entry;
  const days = Math.floor((Date.now() - new Date(requestedAt).getTime()) / 86_400_000);
  if (days <= 0) return { ...entry, label: 'Waiting — today' };
  return { ...entry, label: `Waiting ${days} day${days === 1 ? '' : 's'}` };
}

/** Return states that still need someone to do something: a request nobody
 * has answered, a parcel on the bench, and an approval whose refund has not
 * been sent. Drives the rail count and A17's subtitle, the same way
 * AWAITING_FULFILMENT drives A11's. */
export const AWAITING_RETURN = ['requested', 'received', 'approved'] as const;

/** The reasons POST /api/returns accepts (lib/returns, and the E6 template's
 * own label map). A17's Reason filter is built from these rather than from a
 * list invented for the filter. */
export const RETURN_REASONS: Record<string, string> = {
  too_small: 'Too small',
  too_large: 'Too large',
  not_as_described: 'Not as described',
  faulty: 'Faulty',
  changed_mind: 'Changed my mind',
  wrong_item_sent: 'Wrong item sent',
  arrived_late: 'Arrived late',
};

/**
 * audit_logs.action, for A23. These are the actions this codebase actually
 * writes, not the eight §9.6 asks for — see the Audit log page's own note
 * for which of the eight are missing and why.
 *
 * The three failure actions are Danger because they are the only entries
 * that mean something went wrong; a refund is Danger too, which looks odd
 * next to them until you remember the design does exactly that (146:3734)
 * and it is right: money leaving is the entry you scan a log for.
 */
export const AUDIT_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  // Money.
  order_refunded: { label: 'Refund issued', tone: 'danger' },
  return_refunded: { label: 'Return refunded', tone: 'danger' },
  order_cancelled: { label: 'Order cancelled', tone: 'attention' },
  // Fulfilment (011).
  fulfilment_processing: { label: 'Packing started', tone: 'info' },
  fulfilment_packed: { label: 'Packed', tone: 'info' },
  fulfilment_shipped: { label: 'Order shipped', tone: 'success' },
  // Returns (014).
  return_received: { label: 'Return received', tone: 'info' },
  return_approved: { label: 'Return approved', tone: 'success' },
  return_rejected: { label: 'Return rejected', tone: 'danger' },
  // Stock (015).
  stock_adjusted: { label: 'Stock adjusted', tone: 'attention' },
  // Failures. Every audit row in this codebase was one of these until 011.
  oversell_detected: { label: 'Oversell detected', tone: 'danger' },
  email_delivery_failed: { label: 'Email failed', tone: 'danger' },
  refund_not_recorded: { label: 'Refund not recorded', tone: 'danger' },
};

/**
 * A19's ACCOUNT column (143:2583). Three states, and the middle one is the
 * reason migration 016 exists at all: whether an email was confirmed lives
 * in auth.users, which `authenticated` cannot read, so admin_customers()
 * resolves it and this only labels the answer.
 *
 * Guest is Neutral rather than Attention deliberately, matching the frame:
 * having no account is not a problem to fix, it is just how most people buy.
 */
export const ACCOUNT_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  verified: { label: 'Verified', tone: 'success' },
  unverified: { label: 'Unverified', tone: 'attention' },
  guest: { label: 'Guest', tone: 'neutral' },
};

/**
 * A20 draws ONE badge per order (144:2796) where A11 draws two — Preparing,
 * Delivered, Refunded in the frame, which is a fulfilment state, a
 * fulfilment state and a payment state side by side. So a rule is needed
 * for which column wins, and it is "whatever has stopped being about
 * fulfilment":
 *
 *  - Money undone (refunded, part refunded) or an order that was cancelled
 *    outright is the whole story of that line; where it had got to in the
 *    stockroom no longer matters.
 *  - An order that was never paid for has nothing to fulfil, so Pending or
 *    Failed is the true state rather than "Not started".
 *  - Everything else is its fulfilment state, which is what someone
 *    scanning a customer's history actually wants to know.
 */
export function orderBadge(
  paymentStatus: string,
  fulfilmentStatus: string,
): { label: string; tone: BadgeTone } {
  if (paymentStatus === 'refunded' || paymentStatus === 'partially_refunded') {
    return PAYMENT_BADGE[paymentStatus];
  }
  if (fulfilmentStatus === 'cancelled') return FULFILMENT_BADGE.cancelled;
  if (paymentStatus === 'pending' || paymentStatus === 'failed') {
    return PAYMENT_BADGE[paymentStatus];
  }
  return FULFILMENT_BADGE[fulfilmentStatus] ?? { label: fulfilmentStatus, tone: 'neutral' };
}

/**
 * collection_status (001_schema.sql:15), for A09's list and A10's
 * Publishing panel. Three values, three drawn states (145:2518/2544/2559),
 * and they line up exactly — the only admin enum so far where the design
 * and the schema agree on every label.
 *
 * `scheduled` is Info rather than Attention because a scheduled collection
 * is not waiting on anybody; see A10's own note for the part that IS a
 * problem, which is that nothing promotes it to live when the date passes.
 */
export const COLLECTION_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  live: { label: 'Live', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  hidden: { label: 'Hidden', tone: 'neutral' },
};

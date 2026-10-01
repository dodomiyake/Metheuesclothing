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

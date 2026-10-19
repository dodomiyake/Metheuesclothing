import { orderStatus, type OrderStatusInput } from '@/lib/orders/status';

/**
 * 12 Orders' status pill (102:3419) — a bordered 999px pill with a dot and
 * the word. The same shape as the admin's Status Badge and for the same
 * reason: the WORD carries the meaning and the dot only reinforces it, so
 * it survives greyscale (rule 8).
 *
 * `suffix` is for the frame's "Delivered 15 August" — the date belongs to
 * the status rather than beside it, and only exists when delivered_at does.
 */
export function OrderStatusPill({
  order,
  suffix,
}: {
  order: OrderStatusInput;
  suffix?: string | null;
}) {
  const status = orderStatus(order);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 12px',
        borderRadius: 999,
        border: '1px solid var(--mc-border-default)',
        background: 'var(--mc-bg-surface)',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{ width: 8, height: 8, borderRadius: '50%', background: status.colour, flexShrink: 0 }}
      />
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--mc-text-primary)' }}>
        {status.label}
        {suffix ? ` ${suffix}` : ''}
      </span>
    </span>
  );
}

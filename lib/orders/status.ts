/**
 * One definition of "where is this order", shared by /track-order (the
 * guest view) and the account cluster (12 Orders, 13 Order Detail).
 *
 * It lived inside the track-order page until the account screens needed
 * exactly the same grammar — the ledger's note on 13 Order Detail says so
 * outright ("same timeline grammar as 13 Order Detail" appears again on 17
 * Return Details). Two copies of this would drift the first time a status
 * was added, and a customer reading "Preparing" on one page and "Paid" on
 * another for the same order is the kind of thing nobody reports and
 * everybody notices.
 *
 * COLOUR IS NEVER THE ONLY SIGNAL (CLAUDE.md rule 8): every caller renders
 * the label beside the dot, and the colour only reinforces it.
 */
export type OrderStatusInput = {
  payment_status: string;
  fulfilment_status: string;
  cancelled_at: string | null;
};

export function orderStatus(order: OrderStatusInput): { label: string; colour: string } {
  if (order.cancelled_at) return { label: 'Cancelled', colour: 'var(--mc-status-attention)' };
  if (order.payment_status === 'refunded') {
    return { label: 'Refunded', colour: 'var(--mc-status-attention)' };
  }
  if (order.payment_status === 'partially_refunded') {
    return { label: 'Partially refunded', colour: 'var(--mc-status-attention)' };
  }
  if (order.fulfilment_status === 'delivered') {
    return { label: 'Delivered', colour: 'var(--mc-status-success)' };
  }
  if (order.fulfilment_status === 'shipped') {
    return { label: 'Shipped', colour: 'var(--mc-status-success)' };
  }
  if (order.fulfilment_status === 'processing' || order.fulfilment_status === 'packed') {
    return { label: 'Preparing', colour: 'var(--mc-text-primary)' };
  }
  if (order.payment_status === 'paid') return { label: 'Paid', colour: 'var(--mc-text-primary)' };
  return { label: 'Processing', colour: 'var(--mc-text-muted)' };
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

export type TimelineStep = { label: string; state: 'done' | 'current' | 'todo'; detail?: string };

/**
 * The five steps, with real timestamps only where the schema holds one.
 *
 * "Reached" tracks how far fulfilment has actually got; "current" is which
 * single step is in progress right now. Conflating the two once made a
 * processing order show Dispatched as current instead of Preparing.
 *
 * placed_at, shipped_at and delivered_at are the only real times here —
 * the schema has no per-transition history (fulfilment_status is one
 * current value), which is the same gap A12's own timeline states.
 */
export function buildOrderTimeline(
  order: OrderStatusInput & { placed_at: string },
  shippedAt: string | null,
  deliveredAt: string | null,
): TimelineStep[] {
  const paid = order.payment_status !== 'pending' && order.payment_status !== 'failed';
  const reachedShipped = ['shipped', 'delivered'].includes(order.fulfilment_status);
  const reachedDelivered = order.fulfilment_status === 'delivered';

  return [
    {
      label: 'Order placed',
      state: 'done',
      detail: new Date(order.placed_at).toLocaleDateString('en-GB', DATE_FORMAT),
    },
    { label: 'Payment confirmed', state: paid ? 'done' : 'todo' },
    {
      label: 'Preparing your order',
      state: reachedShipped ? 'done' : paid ? 'current' : 'todo',
    },
    {
      label: 'Dispatched',
      state: reachedDelivered ? 'done' : reachedShipped ? 'current' : 'todo',
      detail: shippedAt ? new Date(shippedAt).toLocaleDateString('en-GB', DATE_FORMAT) : undefined,
    },
    {
      label: 'Delivered',
      state: reachedDelivered ? 'done' : 'todo',
      detail: deliveredAt ? new Date(deliveredAt).toLocaleDateString('en-GB', DATE_FORMAT) : undefined,
    },
  ];
}

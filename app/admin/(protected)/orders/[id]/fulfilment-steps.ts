/**
 * A12's FULFILMENT timeline (139:1736), derived rather than stored.
 *
 * The design gives every step a timestamp AND an actor — "Processing started
 * · 5 September, 09:02 · Dami". The schema has neither: `orders` records
 * placed_at and cancelled_at and nothing else per-transition, and
 * fulfilment_status is a single current value with no history behind it. The
 * only real per-step times are placed_at, fulfilments.shipped_at and
 * fulfilments.delivered_at.
 *
 * So each step shows a real timestamp where one exists and says plainly what
 * it is otherwise, instead of inventing times. Inventing them would be worse
 * here than on a customer-facing screen: this is the view someone would use
 * to answer "when did we actually pack this", and a confident wrong answer
 * is the whole problem.
 *
 * The same shape as the track-order timeline, and it repeats that screen's
 * one correctness lesson: REACHED is not COMPLETED. A `processing` order has
 * reached "Preparing" but has not finished it, so "Preparing" is the current
 * step and "Packed" is still to do. Conflating the two marked a later step
 * done on the customer-facing page before anyone had touched the parcel.
 *
 * Capturing per-step times properly means either a status-history table or
 * writing an audit_logs row on every transition. Migration 011 started that:
 * advance_fulfilment and ship_order each write one. The timestamps here do
 * not read them back yet, because an audit row records an action rather than
 * a state and matching the two is a query this screen does not do — so a
 * packed order still says "no timestamp recorded for this step" even though
 * the log now has one. Worth closing once A15/A16 land and every transition
 * writes.
 */
export type StepState = 'done' | 'current' | 'todo';

export type FulfilmentStep = {
  label: string;
  detail: string;
  state: StepState;
};

const ORDER: string[] = ['not_started', 'processing', 'packed', 'shipped', 'delivered'];

export function buildFulfilmentSteps({
  paymentStatus,
  fulfilmentStatus,
  placedAt,
  cancelledAt,
  fulfilment,
}: {
  paymentStatus: string;
  fulfilmentStatus: string;
  placedAt: string;
  cancelledAt: string | null;
  fulfilment: { shipped_at: string; delivered_at: string | null } | null;
}): FulfilmentStep[] {
  const when = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}, ${d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  if (cancelledAt) {
    // A cancelled order never reaches the rest of the sequence, so showing
    // four greyed future steps under it would imply it still might.
    return [
      {
        label: 'Payment',
        detail: paymentStatus === 'paid' ? `Paid ${when(placedAt)}` : `Not paid · ${paymentStatus}`,
        state: 'done',
      },
      { label: 'Cancelled', detail: when(cancelledAt), state: 'done' },
    ];
  }

  const paid = paymentStatus === 'paid';
  const reachedIndex = Math.max(0, ORDER.indexOf(fulfilmentStatus));

  const stateFor = (index: number): StepState => {
    if (!paid) return 'todo';
    if (index < reachedIndex) return 'done';
    if (index === reachedIndex) return 'current';
    return 'todo';
  };

  return [
    {
      label: 'Payment confirmed',
      detail: paid
        ? `${when(placedAt)} · Stripe webhook`
        : paymentStatus === 'failed'
          ? 'Payment failed'
          : 'Awaiting Stripe',
      state: paid ? 'done' : 'current',
    },
    {
      label: 'Preparing',
      detail: detailFor(stateFor(1), 'Not started yet'),
      state: stateFor(1),
    },
    {
      label: 'Packed',
      detail: detailFor(stateFor(2), 'Not packed yet'),
      state: stateFor(2),
    },
    {
      label: 'Shipped',
      // Deliberately no claim about the E4 email here. ship_order writes the
      // fulfilment row and the send is best-effort after it, so "email sent"
      // would be true most of the time and wrong exactly when it matters.
      // A failed send writes email_delivery_failed, which the audit panel
      // below already shows.
      detail: fulfilment
        ? when(fulfilment.shipped_at)
        : 'Not yet — adding tracking is what marks this done',
      state: fulfilment ? 'done' : stateFor(3),
    },
    {
      label: 'Delivered',
      detail: fulfilment?.delivered_at
        ? when(fulfilment.delivered_at)
        : 'Not yet — no delivery estimate is stored',
      state: fulfilment?.delivered_at ? 'done' : stateFor(4),
    },
  ];
}

/** No per-transition timestamp exists, so a completed step says so rather
 * than showing a time it cannot know. */
function detailFor(state: StepState, todoText: string): string {
  if (state === 'done') return 'Done — no timestamp recorded for this step';
  if (state === 'current') return 'Current step';
  return todoText;
}

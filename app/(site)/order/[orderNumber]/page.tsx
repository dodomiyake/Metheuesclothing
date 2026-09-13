import Link from 'next/link';

/**
 * Where Stripe's success_url lands (app/api/checkout/route.ts). Deliberately
 * shows nothing beyond the order number itself: this route is reachable with
 * nothing but a guessable number in the URL (MC-10001, MC-10002, ... — see
 * the same comment in app/api/orders/lookup/route.ts), no email, no session.
 * Rule 5 exists precisely so order contents are never readable from a number
 * alone; querying the order here to show items/address/total would be that
 * exact mistake with an extra step. Full detail stays behind /track-order,
 * which re-proves order number + email together before showing anything.
 */
export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  return (
    <main
      style={{
        padding: 'var(--mc-space-3xl) var(--mc-gutter-desktop)',
        fontFamily: 'var(--mc-font-body)',
        maxWidth: 640,
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontSize: 'var(--mc-type-label)',
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          color: 'var(--mc-status-success)',
          fontWeight: 600,
        }}
      >
        Order confirmed
      </p>
      <h1
        style={{
          fontFamily: 'var(--mc-font-display)',
          fontSize: 'var(--mc-type-page-title)',
          margin: 'var(--mc-space-sm) 0',
        }}
      >
        Thank you
      </h1>
      <p style={{ fontSize: 'var(--mc-type-body-lead)', color: 'var(--mc-text-primary)' }}>
        Your order <strong>{orderNumber}</strong> has been placed.
      </p>
      <p style={{ color: 'var(--mc-text-muted)', marginTop: 'var(--mc-space-md)' }}>
        A confirmation has been sent to the email address you checked out with.
        For the full order — items, delivery address and status — look it up
        with your order number and email.
      </p>
      <Link
        href="/track-order"
        style={{
          display: 'inline-block',
          marginTop: 'var(--mc-space-xl)',
          minHeight: 44,
          lineHeight: '44px',
          padding: '0 var(--mc-space-xl)',
          background: 'var(--mc-action-primary-bg)',
          color: 'var(--mc-action-primary-text)',
          borderRadius: 'var(--mc-radius-sm)',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Track this order
      </Link>
    </main>
  );
}

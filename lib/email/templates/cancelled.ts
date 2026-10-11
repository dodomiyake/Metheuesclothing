import {
  renderEmailLayout,
  escapeHtml,
  BODY_FONT,
  BLACK,
  IVORY,
  SAND,
  STONE,
} from '../layout';
import { formatPence } from '@/lib/money';

/**
 * E5 — cancellation confirmation (Figma 164:114). Sent by
 * POST /api/admin/orders/[id]/cancel, built alongside it the way E3, E4 and
 * E6 went in.
 *
 * NO CTA, which is the design's own decision and worth keeping rather than
 * adding a button out of habit: "There is nothing for the customer to do,
 * and a button here would only lead somewhere that says the same thing."
 * design-system-state.json records the same for E5 and E7.
 *
 * TWO NARROWINGS from the drawn version.
 *
 *  - "Back to — Visa ending 4242". payments.card_brand and card_last4 exist
 *    in the schema but the Stripe webhook never writes them, so the row would
 *    read "Back to — null ending null" on every real send. It says "the card
 *    you paid with", which is true and is what the customer needs to look at
 *    anyway. The fix is a few lines in the webhook; until it lands, naming a
 *    card we did not record is how an email gets forwarded to a bank as
 *    evidence of something that was never checked.
 *
 *  - "The full amount is on its way back to you" is conditional here. An
 *    order cancelled before Stripe confirmed the payment has no money to
 *    return, and cancel_order deliberately does not invent a refund for one
 *    (it leaves payment_status alone rather than marking it refunded). The
 *    email has to survive that case rather than promise a refund that will
 *    never arrive.
 */
export function buildCancelledEmail(
  order: { order_number: string },
  refundPence: number | null,
): { subject: string; html: string; text: string } {
  const refunded = typeof refundPence === 'number' && refundPence > 0;
  const subject = refunded
    ? `Order ${order.order_number} cancelled — ${formatPence(refundPence!)} refunded`
    : `Order ${order.order_number} cancelled`;

  const row = (label: string, value: string, strong?: boolean) => `
      <tr>
        <td style="padding:8px 0; font-family:${BODY_FONT}; font-size:14px; color:${STONE};">
          ${escapeHtml(label)}
        </td>
        <td align="right" style="padding:8px 0; font-family:${BODY_FONT}; font-size:${
          strong ? '15px; font-weight:600' : '14px'
        }; color:${BLACK};">
          ${escapeHtml(value)}
        </td>
      </tr>`;

  const refundPanel = refunded
    ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${IVORY};">
                <tr>
                  <td style="padding:18px;">
                    <p style="margin:0 0 6px; font-family:${BODY_FONT}; font-size:10px; font-weight:600; letter-spacing:1.2px; color:${STONE};">
                      REFUND
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${row('Amount', formatPence(refundPence!), true)}
                      ${row('Back to', 'The card you paid with')}
                      ${row('Expect it within', '5 to 10 working days')}
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">
                Banks vary &mdash; 5 to 10 working days is the window they give us, and it is usually quicker.
              </p>`
    : `
              <p style="margin:0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">
                No payment was taken for this order, so there is nothing to refund.
              </p>`;

  const bodyHtml = `
          <tr>
            <td style="padding:32px 40px 8px;">
              <p style="margin:0 0 18px; font-family:${BODY_FONT}; font-size:22px; font-weight:600; line-height:30px; color:${BLACK};">
                Your order is cancelled
              </p>
              <p style="margin:0 0 18px; font-family:${BODY_FONT}; font-size:15px; line-height:24px; color:${BLACK};">
                Order ${escapeHtml(order.order_number)} has been cancelled and nothing will be sent.${
                  refunded ? ' The full amount is on its way back to you.' : ''
                }
              </p>
              ${refundPanel}
              <p style="margin:18px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">
                If this was cancelled by mistake, the T-shirts are back in stock and you can order again.
                A cancellation cannot be reversed.
              </p>
              <p style="margin:18px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE}; border-top:1px solid ${SAND}; padding-top:18px;">
                You are receiving this because an order placed with this address was cancelled.
              </p>
            </td>
          </tr>`;

  const text = [
    'Your order is cancelled.',
    '',
    `Order ${order.order_number} has been cancelled and nothing will be sent.`,
    '',
    refunded ? `Refund: ${formatPence(refundPence!)} back to the card you paid with.` : 'No payment was taken, so there is nothing to refund.',
    refunded ? 'Expect it within 5 to 10 working days — banks vary.' : '',
    '',
    'If this was cancelled by mistake, the T-shirts are back in stock and you can order again. A cancellation cannot be reversed.',
  ]
    .filter(Boolean)
    .join('\n');

  // No ctaHtml, deliberately — see the header.
  const html = renderEmailLayout({
    preheader: refunded
      ? `Order ${order.order_number} is cancelled and ${formatPence(refundPence!)} is on its way back.`
      : `Order ${order.order_number} is cancelled.`,
    bodyHtml,
  });

  return { subject, html, text };
}

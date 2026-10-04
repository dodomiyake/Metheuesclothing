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
 * E8 — refund completed (Figma 165:70). Sent by
 * POST /api/admin/orders/[id]/refund, once Stripe has actually sent the money
 * and record_refund has written the row.
 *
 * THE DESIGN DRAWS A DIFFERENT EVENT FROM THE ONE A16 PERFORMS, and the gap
 * matters. Its panel is headed "REFUND RET-4471", lists two returned garments
 * with a price each, and its footer says "you asked to return part of an
 * order". That is the refund at the END of a return (E9's neighbour, A18's
 * decision). A16 is the admin refunding an order directly: there may be no
 * return at all, and there is no line-level refund anywhere in this system —
 * record_refund takes one amount, because `refunds` stores one amount.
 *
 * So three things are narrowed rather than faked:
 *
 *  - The panel is headed with the ORDER number. Printing a return number
 *    that does not exist would send the customer looking for a return they
 *    never opened.
 *  - The per-garment rows are gone. Splitting an arbitrary amount back across
 *    lines would be arithmetic we invented; where it did not divide evenly
 *    the email would disagree with the sum beneath it.
 *  - "Because you asked to return part of an order" becomes the true reason:
 *    a refund was issued on an order placed with this address. The drawn
 *    sentence tells a customer who was refunded for a fault that they
 *    requested something they did not.
 *
 * "Visa ending 4242" goes for the same reason it goes in E5: card_brand and
 * card_last4 are never written by the webhook.
 *
 * Everything the design's own note calls the point of the email is kept —
 * an exact amount, an exact date, and the 10-working-day escape hatch that
 * gives support a clean trigger.
 */
export function buildRefundedEmail(
  order: { order_number: string },
  refund: { amount_pence: number; created_at?: string },
  totalRefundedPence: number,
  orderTotalPence: number,
): { subject: string; html: string; text: string } {
  const amount = formatPence(refund.amount_pence);
  const partial = totalRefundedPence < orderTotalPence;
  const sentOn = new Date(refund.created_at ?? Date.now()).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const subject = `${amount} refunded on order ${order.order_number}`;

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

  const bodyHtml = `
          <tr>
            <td style="padding:32px 40px 8px;">
              <p style="margin:0 0 18px; font-family:${BODY_FONT}; font-size:22px; font-weight:600; line-height:30px; color:${BLACK};">
                Your refund has been sent
              </p>
              <p style="margin:0 0 18px; font-family:${BODY_FONT}; font-size:15px; line-height:24px; color:${BLACK};">
                We have sent ${escapeHtml(amount)} back to the card you paid with. Whether it shows today or
                next week is your bank, not us.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${IVORY};">
                <tr>
                  <td style="padding:18px;">
                    <p style="margin:0 0 6px; font-family:${BODY_FONT}; font-size:10px; font-weight:600; letter-spacing:1.2px; color:${STONE};">
                      REFUND ON ORDER ${escapeHtml(order.order_number)}
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${row('This refund', amount, true)}
                      ${
                        // Only shown when it differs, so a full refund does
                        // not carry a confusing second identical number.
                        totalRefundedPence !== refund.amount_pence
                          ? row('Refunded on this order so far', formatPence(totalRefundedPence))
                          : ''
                      }
                      ${row('Order total', formatPence(orderTotalPence))}
                      ${row('Sent', sentOn)}
                    </table>
                  </td>
                </tr>
              </table>
              ${
                partial
                  ? `<p style="margin:18px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">
                This is a partial refund. The rest of the order stands.
              </p>`
                  : ''
              }
              <p style="margin:18px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">
                If it has not appeared after 10 working days, reply to this email and we will send you the
                reference your bank needs.
              </p>
              <p style="margin:18px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">
                Keep this email &mdash; it is your record of the refund.
              </p>
              <p style="margin:18px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE}; border-top:1px solid ${SAND}; padding-top:18px;">
                You are receiving this because a refund was issued on an order placed with this address.
                It is a service message, not marketing.
              </p>
            </td>
          </tr>`;

  const text = [
    'Your refund has been sent.',
    '',
    `${amount} has gone back to the card you paid with, on order ${order.order_number}.`,
    totalRefundedPence !== refund.amount_pence
      ? `Refunded on this order so far: ${formatPence(totalRefundedPence)} of ${formatPence(orderTotalPence)}.`
      : `Order total: ${formatPence(orderTotalPence)}.`,
    `Sent: ${sentOn}`,
    '',
    partial ? 'This is a partial refund. The rest of the order stands.' : '',
    'If it has not appeared after 10 working days, reply to this email and we will send you the reference your bank needs.',
    '',
    'Keep this email — it is your record of the refund.',
  ]
    .filter(Boolean)
    .join('\n');

  // No CTA: there is nothing to do and no page that says more than this.
  const html = renderEmailLayout({
    preheader: `${amount} refunded to the card you paid with.`,
    bodyHtml,
  });

  return { subject, html, text };
}

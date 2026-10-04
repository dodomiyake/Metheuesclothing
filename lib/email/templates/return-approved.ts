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
 * E7 — return accepted (Figma 165:42). Sent by
 * POST /api/admin/returns/[id]/refund, NOT by the approve route.
 *
 * THE LEDGER'S ID MAP AND ITS DECISION LIST LOOKED LIKE THEY DISAGREED, and
 * the artwork settles it. The map calls 165:42 "E7 Return approved"; the
 * decisions list says "E7 sends when the refund has actually left (A16), not
 * on approval (A18)". The frame's own canvas note is the tie-break: "No CTA.
 * Approval and refund are separate events in the admin (A18 then A16), so
 * this email is only sent once the money has actually left — never on
 * approval alone." Its body says "Your refund has been sent."
 *
 * So the name describes the OUTCOME being communicated, not the trigger. E7
 * and E8 are the same moment — money leaving — told two ways: E7 when a
 * return is behind it, E8 when the refund is an order-level one with no
 * return. `refunds.return_id` (013) is what lets the route tell them apart,
 * and adding that column is the only reason this distinction can exist at
 * all. Worth confirming the naming with the design owner anyway, alongside
 * "To pack" and A14's send checkbox — the id map reads as a contradiction
 * until you open the frame.
 *
 * APPROVAL ITSELF SENDS NOTHING, which follows from the above and is worth
 * stating because it is a real gap in the customer's experience: between E6
 * ("we have your request") and this, they hear nothing while the parcel
 * travels, arrives and is checked. That is the design's intent as drawn, not
 * an omission here.
 *
 * Narrowed, for the reason E5 and E8 are: "Back to — Visa ending 4242" says
 * "the card you paid with", because payments.card_brand and card_last4 are
 * never written by the Stripe webhook.
 *
 * Kept exactly: no CTA, and the two closing lines. "Delivery paid on the
 * original order is not refunded" is a real policy statement and this
 * function cannot verify it from data, so it is phrased as the policy rather
 * than as a fact about this refund — see the conditional below.
 */
export function buildReturnApprovedEmail(
  ret: { return_number: string },
  order: { order_number: string },
  refundPence: number,
  items: { product_name: string; colour: string; size: string; quantity: number }[],
  deliveryPaidPence: number,
): { subject: string; html: string; text: string } {
  const amount = formatPence(refundPence);
  const subject = `Return ${ret.return_number} accepted — ${amount} on its way`;

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

  const itemLines = items
    .map(
      (i) =>
        `<p style="margin:0 0 4px; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">${escapeHtml(
          `${i.product_name} — ${i.colour} / ${i.size}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`,
        )}</p>`,
    )
    .join('');

  const bodyHtml = `
          <tr>
            <td style="padding:32px 40px 8px;">
              <p style="margin:0 0 18px; font-family:${BODY_FONT}; font-size:22px; font-weight:600; line-height:30px; color:${BLACK};">
                Your return is accepted
              </p>
              <p style="margin:0 0 18px; font-family:${BODY_FONT}; font-size:15px; line-height:24px; color:${BLACK};">
                ${
                  items.length === 1
                    ? 'It arrived and passed the check.'
                    : 'They arrived and passed the check.'
                } Your refund has been sent.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${IVORY};">
                <tr>
                  <td style="padding:18px;">
                    <p style="margin:0 0 6px; font-family:${BODY_FONT}; font-size:10px; font-weight:600; letter-spacing:1.2px; color:${STONE};">
                      REFUND &middot; RETURN ${escapeHtml(ret.return_number)}
                    </p>
                    ${itemLines}
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${row('Amount', amount, true)}
                      ${row('Back to', 'The card you paid with')}
                      ${row('Expect it within', '5 to 10 working days')}
                      ${row('Order', order.order_number)}
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">
                Banks vary &mdash; 5 to 10 working days is the window they give us, and it is usually quicker.
              </p>
              ${
                // Only claimed when there WAS delivery to not refund. On a
                // free-delivery order the sentence would be a policy lecture
                // about money the customer never paid.
                deliveryPaidPence > 0
                  ? `<p style="margin:18px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">
                The ${escapeHtml(
                  formatPence(deliveryPaidPence),
                )} delivery paid on the original order is not refunded &mdash; that is in the returns policy and has not changed.
              </p>`
                  : ''
              }
              <p style="margin:18px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">
                Thank you for sending ${items.length === 1 ? 'it' : 'them'} back in good condition. It means
                ${items.length === 1 ? 'it goes' : 'they go'} back on the shelf rather than to waste.
              </p>
              <p style="margin:18px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE}; border-top:1px solid ${SAND}; padding-top:18px;">
                You are receiving this because you asked to return part of an order. It is a service
                message, not marketing.
              </p>
            </td>
          </tr>`;

  const text = [
    'Your return is accepted.',
    '',
    `Return ${ret.return_number} on order ${order.order_number}.`,
    ...items.map((i) => `- ${i.product_name} — ${i.colour} / ${i.size}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`),
    '',
    `Refund: ${amount} back to the card you paid with.`,
    'Expect it within 5 to 10 working days — banks vary.',
    deliveryPaidPence > 0
      ? `The ${formatPence(deliveryPaidPence)} delivery paid on the original order is not refunded.`
      : '',
    '',
    'Thank you for sending it back in good condition.',
  ]
    .filter(Boolean)
    .join('\n');

  // No ctaHtml, deliberately — see the header.
  const html = renderEmailLayout({
    preheader: `Return ${ret.return_number} accepted · ${amount} on its way.`,
    bodyHtml,
  });

  return { subject, html, text };
}

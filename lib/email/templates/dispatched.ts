import {
  renderEmailLayout,
  renderCta,
  escapeHtml,
  BODY_FONT,
  BLACK,
  IVORY,
  SAND,
  STONE,
} from '../layout';

/**
 * E4 — dispatched. Sent by POST /api/admin/orders/[id]/ship, which is the
 * only thing that creates a fulfilment row. Built alongside that route
 * rather than ahead of it, the way E3 and E6 went in: a template with no
 * caller is a template nobody finds out is broken.
 *
 * There is deliberately no "mark as sent" step anywhere. A14's own copy
 * says it: "Adding a carrier and number marks the order shipped and sends
 * the dispatch email — there is no separate send button." The alternative
 * is an order that is shipped in the database while the customer has heard
 * nothing, which is the state people email about.
 *
 * TRACKING URL IS OPTIONAL AND THE EMAIL HAS TO SURVIVE THAT. Not every
 * carrier gives one, fulfilments.tracking_url is nullable, and a "Track your
 * parcel" button pointing nowhere is worse than a carrier and number the
 * customer can paste themselves. With no URL the CTA falls back to the
 * order page, which always exists.
 */
type Order = {
  order_number: string;
  delivery_method: string | null;
};

type Fulfilment = {
  carrier: string;
  tracking_number: string;
  tracking_url: string | null;
};

export function buildDispatchedEmail(
  order: Order,
  fulfilment: Fulfilment,
  itemCount: number,
): { subject: string; html: string; text: string } {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const orderUrl = `${siteUrl}/order/${order.order_number}`;
  const subject = `Order ${order.order_number} is on its way`;

  const detailRow = (label: string, value: string) => `
      <tr>
        <td style="padding:10px 0; border-bottom:1px solid ${SAND}; font-family:${BODY_FONT}; font-size:13px; color:${STONE};">
          ${escapeHtml(label)}
        </td>
        <td align="right" style="padding:10px 0; border-bottom:1px solid ${SAND}; font-family:${BODY_FONT}; font-size:14px; color:${BLACK};">
          ${escapeHtml(value)}
        </td>
      </tr>`;

  const bodyHtml = `
          <tr>
            <td style="padding:32px 40px 8px;">
              <p style="margin:0 0 12px; font-family:${BODY_FONT}; font-size:20px; font-weight:600; color:${BLACK};">
                It&rsquo;s on its way
              </p>
              <p style="margin:0 0 20px; font-family:${BODY_FONT}; font-size:15px; line-height:23px; color:${STONE};">
                Order ${escapeHtml(order.order_number)} left us today${
                  itemCount ? ` with ${itemCount} item${itemCount === 1 ? '' : 's'}` : ''
                }.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${IVORY}; padding:0;">
                ${detailRow('Carrier', fulfilment.carrier)}
                ${detailRow('Tracking number', fulfilment.tracking_number)}
                ${order.delivery_method ? detailRow('Service', order.delivery_method) : ''}
              </table>
              <p style="margin:20px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">
                Tracking can take a few hours to show its first scan. If it is still empty tomorrow,
                reply to this email and we will chase it.
              </p>
            </td>
          </tr>`;

  const text = [
    `Order ${order.order_number} is on its way.`,
    '',
    `Carrier: ${fulfilment.carrier}`,
    `Tracking number: ${fulfilment.tracking_number}`,
    order.delivery_method ? `Service: ${order.delivery_method}` : '',
    fulfilment.tracking_url ? `Track it: ${fulfilment.tracking_url}` : '',
    '',
    'Tracking can take a few hours to show its first scan.',
    '',
    `View your order: ${orderUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = renderEmailLayout({
    preheader: `Order ${order.order_number} has been dispatched.`,
    bodyHtml,
    ctaHtml: fulfilment.tracking_url
      ? renderCta('Track your parcel', fulfilment.tracking_url)
      : renderCta('View your order', orderUrl),
  });

  return { subject, html, text };
}

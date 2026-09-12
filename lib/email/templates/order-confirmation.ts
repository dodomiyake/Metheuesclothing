import { formatPence } from '@/lib/money';
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
 * E3 — order confirmation. "Mirrors 09 Order Confirmation exactly — same
 * order number, items and total. If screen and email disagree the customer
 * trusts neither" (design-system-state.json, transactional_email.decisions).
 * There is no order confirmation screen built yet, so this is the first of
 * the two and the one the screen must match when it exists, not the other
 * way round.
 */

type OrderItem = {
  product_name: string;
  colour: string;
  size: string;
  quantity: number;
  unit_price_pence: number;
  line_total_pence: number;
};

type DeliveryAddress = {
  name?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    postal_code?: string;
    state?: string;
    country?: string;
  };
};

type Order = {
  order_number: string;
  email: string;
  profile_id: string | null;
  currency: string;
  subtotal_pence: number;
  delivery_pence: number;
  total_pence: number;
  delivery_method: string | null;
  delivery_address: DeliveryAddress | null;
};

const STEPS = ['Confirmed', 'Preparing', 'Shipped', 'Delivered'] as const;

export function buildOrderConfirmationEmail(
  order: Order,
  items: OrderItem[],
  returnWindowDays: number,
): { subject: string; html: string; text: string } {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const orderUrl = `${siteUrl}/order/${order.order_number}`;

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0; border-bottom:1px solid ${SAND}; font-family:${BODY_FONT}; font-size:14px; color:${BLACK};">
          ${escapeHtml(item.product_name)}<br />
          <span style="font-size:12px; color:${STONE};">${escapeHtml(item.colour)} / ${escapeHtml(item.size)} &middot; Qty ${item.quantity}</span>
        </td>
        <td align="right" style="padding:12px 0; border-bottom:1px solid ${SAND}; font-family:${BODY_FONT}; font-size:14px; color:${BLACK}; white-space:nowrap;">
          ${formatPence(item.line_total_pence, order.currency)}
        </td>
      </tr>`,
    )
    .join('');

  // Bold marks the current step so the state does not rest on colour alone —
  // §8 "colour is never the only signal for state".
  const timeline = STEPS.map(
    (step, i) =>
      `<span style="font-family:${BODY_FONT}; font-size:12px; color:${i === 0 ? BLACK : STONE}; font-weight:${i === 0 ? 700 : 400};">${step}</span>`,
  ).join(`<span style="color:${STONE}; font-size:12px;"> &rarr; </span>`);

  const addr = order.delivery_address?.address;
  const addressLines = [
    order.delivery_address?.name,
    addr?.line1,
    addr?.line2,
    [addr?.city, addr?.postal_code].filter(Boolean).join(' '),
    addr?.country,
  ].filter(Boolean) as string[];

  const accountPrompt = order.profile_id
    ? ''
    : `<p style="margin:16px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">
         You checked out as a guest. <a href="${siteUrl}/account" style="color:${BLACK};">Create an account</a> with this email to track this order alongside any future ones.
       </p>`;

  const bodyHtml = `
    <tr>
      <td style="padding:32px 40px 8px;">
        <p style="margin:0 0 4px; font-family:${BODY_FONT}; font-size:13px; color:${STONE};">Order ${escapeHtml(order.order_number)}</p>
        <h1 style="margin:0 0 16px; font-family:${BODY_FONT}; font-size:22px; color:${BLACK};">Thank you for your order</h1>
        <p style="margin:0 0 20px; font-family:${BODY_FONT}; font-size:14px; line-height:22px; color:${BLACK};">
          We've received your payment and we're getting your order ready.
        </p>
        <p style="margin:0 0 24px;">${timeline}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${itemRows}
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
          <tr>
            <td style="padding:4px 0; font-family:${BODY_FONT}; font-size:13px; color:${STONE};">Subtotal</td>
            <td align="right" style="padding:4px 0; font-family:${BODY_FONT}; font-size:13px; color:${BLACK};">${formatPence(order.subtotal_pence, order.currency)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0; font-family:${BODY_FONT}; font-size:13px; color:${STONE};">Delivery</td>
            <td align="right" style="padding:4px 0; font-family:${BODY_FONT}; font-size:13px; color:${BLACK};">${order.delivery_pence === 0 ? 'Free' : formatPence(order.delivery_pence, order.currency)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0 0; font-family:${BODY_FONT}; font-size:15px; font-weight:700; color:${BLACK};">Total paid</td>
            <td align="right" style="padding:8px 0 0; font-family:${BODY_FONT}; font-size:15px; font-weight:700; color:${BLACK};">${formatPence(order.total_pence, order.currency)}</td>
          </tr>
        </table>
      </td>
    </tr>
    ${
      addressLines.length
        ? `<tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${IVORY};">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 6px; font-family:${BODY_FONT}; font-size:12px; letter-spacing:1px; text-transform:uppercase; color:${STONE};">Delivering to</p>
              <p style="margin:0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${BLACK};">
                ${addressLines.map(escapeHtml).join('<br />')}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
        : ''
    }
    <tr>
      <td style="padding:24px 40px 0;">
        <p style="margin:0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">
          Changed your mind about something? Returns are open for ${returnWindowDays} days from delivery.
        </p>
        ${accountPrompt}
      </td>
    </tr>`;

  const subject = `Order confirmed — ${order.order_number}`;

  const text = [
    `Order ${order.order_number} confirmed`,
    '',
    "We've received your payment and we're getting your order ready.",
    '',
    ...items.map(
      (item) =>
        `${item.product_name} (${item.colour} / ${item.size}) x${item.quantity} — ${formatPence(item.line_total_pence, order.currency)}`,
    ),
    '',
    `Subtotal: ${formatPence(order.subtotal_pence, order.currency)}`,
    `Delivery: ${order.delivery_pence === 0 ? 'Free' : formatPence(order.delivery_pence, order.currency)}`,
    `Total paid: ${formatPence(order.total_pence, order.currency)}`,
    '',
    ...(addressLines.length ? ['Delivering to:', ...addressLines] : []),
    '',
    `Returns are open for ${returnWindowDays} days from delivery.`,
    '',
    `View your order: ${orderUrl}`,
  ].join('\n');

  const html = renderEmailLayout({
    preheader: `Order ${order.order_number} confirmed — we're getting it ready.`,
    bodyHtml,
    ctaHtml: renderCta('View your order', orderUrl),
  });

  return { subject, html, text };
}

import {
  renderEmailLayout,
  escapeHtml,
  BODY_FONT,
  BLACK,
  IVORY,
  SAND,
  STONE,
} from '../layout';

/**
 * E6 — return request received. Sent from POST /api/returns once
 * request_return() has committed (see the comment there: "E6 is the email
 * that carries the address to post it to").
 *
 * It cannot actually carry that address: there is no configured return
 * address anywhere in this codebase (store_settings has no such column, and
 * nothing in docs/SPEC.md names one), which puts it in the same bucket as
 * the other owner-blocked details in CLAUDE.md — delivery rates, the
 * verified sending domain, and so on. Automatic labels are deferred for the
 * same reason (see the route). So this says a member of the team will follow
 * up with instructions, which is true, rather than printing a placeholder
 * address that would ship as if it were real.
 */

const REASON_LABELS: Record<string, string> = {
  too_small: 'Too small',
  too_large: 'Too large',
  not_as_described: 'Not as described',
  faulty: 'Faulty',
  changed_mind: 'Changed my mind',
  wrong_item_sent: 'Wrong item sent',
  arrived_late: 'Arrived late',
};

type ReturnItem = {
  quantity: number;
  reason: string;
  product_name: string;
  colour: string;
  size: string;
};

export function buildReturnReceivedEmail(
  order: { order_number: string },
  ret: { return_number: string },
  items: ReturnItem[],
  contactEmail: string,
): { subject: string; html: string; text: string } {
  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0; border-bottom:1px solid ${SAND}; font-family:${BODY_FONT}; font-size:14px; color:${BLACK};">
          ${escapeHtml(item.product_name)}<br />
          <span style="font-size:12px; color:${STONE};">${escapeHtml(item.colour)} / ${escapeHtml(item.size)} &middot; Qty ${item.quantity}</span>
        </td>
        <td align="right" style="padding:12px 0; border-bottom:1px solid ${SAND}; font-family:${BODY_FONT}; font-size:13px; color:${STONE}; white-space:nowrap;">
          ${escapeHtml(REASON_LABELS[item.reason] ?? item.reason)}
        </td>
      </tr>`,
    )
    .join('');

  const bodyHtml = `
    <tr>
      <td style="padding:32px 40px 8px;">
        <p style="margin:0 0 4px; font-family:${BODY_FONT}; font-size:13px; color:${STONE};">Return ${escapeHtml(ret.return_number)} &middot; Order ${escapeHtml(order.order_number)}</p>
        <h1 style="margin:0 0 16px; font-family:${BODY_FONT}; font-size:22px; color:${BLACK};">We've got your return request</h1>
        <p style="margin:0 0 24px; font-family:${BODY_FONT}; font-size:14px; line-height:22px; color:${BLACK};">
          Someone from our team will be in touch with instructions for sending these back to us. You don't need to do anything else yet.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${itemRows}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${IVORY};">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${BLACK};">
                Questions about this return? Reply to this email or write to
                <a href="mailto:${escapeHtml(contactEmail)}" style="color:${BLACK};">${escapeHtml(contactEmail)}</a>
                and quote ${escapeHtml(ret.return_number)}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  const subject = `Return received — ${ret.return_number}`;

  const text = [
    `Return ${ret.return_number} (order ${order.order_number})`,
    '',
    "We've got your return request. Someone from our team will be in touch with instructions for sending these back to us.",
    '',
    ...items.map(
      (item) =>
        `${item.product_name} (${item.colour} / ${item.size}) x${item.quantity} — ${REASON_LABELS[item.reason] ?? item.reason}`,
    ),
    '',
    `Questions? ${contactEmail}, quoting ${ret.return_number}.`,
  ].join('\n');

  const html = renderEmailLayout({
    preheader: `Return ${ret.return_number} received — we'll follow up with next steps.`,
    bodyHtml,
  });

  return { subject, html, text };
}

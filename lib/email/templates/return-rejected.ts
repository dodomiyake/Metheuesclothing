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
 * E9 — return rejected (Figma 165:102). Sent by
 * POST /api/admin/returns/[id]/decide when the decision is a rejection.
 *
 * Its own canvas note calls it "the hardest email to write" and names the
 * three things that make it bearable: it states the specific finding rather
 * than a policy code, it returns the item at our cost rather than holding it
 * hostage, and it offers a route to challenge. No apology theatre, no
 * accusation. All three are kept.
 *
 * THE FINDING IS THE STAFF MEMBER'S OWN WORDS, not a template. decide_return
 * requires a reason to reject, and A18 says it plainly: "Required if you
 * reject. The customer is emailed this reason in plain language." So this
 * prints what was typed. That is also why the dialog's helper warns about it
 * — there is no second draft between the admin screen and the customer's
 * inbox.
 *
 * ONE THING IS NARROWED. "We are posting it back to you at our cost — no
 * action needed, it should arrive within a week" is a promise nothing in
 * this system keeps or tracks: there is no return-to-sender fulfilment, no
 * carrier, no timescale anywhere, and no return address configured (the same
 * gap E6 already works around). Printing it would commit the business to a
 * parcel nobody has arranged. It says instead that the item is being sent
 * back and that we will be in touch with the details — true, and it keeps
 * the design's actual principle, which is that we do not keep the goods.
 * Worth raising with the owner alongside the return address E6 needs.
 */
export function buildReturnRejectedEmail(
  ret: { return_number: string },
  order: { order_number: string },
  reason: string,
  items: { product_name: string; colour: string; size: string; condition: string | null }[],
): { subject: string; html: string; text: string } {
  const subject = `About return ${ret.return_number} — we could not accept it`;
  const one = items.length === 1;

  const findings = items
    .map(
      (i) => `
                    <p style="margin:0 0 6px; font-family:${BODY_FONT}; font-size:14px; line-height:21px; color:${BLACK};">
                      ${escapeHtml(`${i.product_name} — ${i.colour} / ${i.size}`)}
                    </p>
                    ${
                      // Per-item condition where one was recorded. A18 records
                      // it per item precisely so a rejection can be specific.
                      i.condition
                        ? `<p style="margin:0 0 12px; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">${escapeHtml(
                            i.condition,
                          )}</p>`
                        : ''
                    }`,
    )
    .join('');

  const bodyHtml = `
          <tr>
            <td style="padding:32px 40px 8px;">
              <p style="margin:0 0 18px; font-family:${BODY_FONT}; font-size:22px; font-weight:600; line-height:30px; color:${BLACK};">
                We could not accept this return
              </p>
              <p style="margin:0 0 18px; font-family:${BODY_FONT}; font-size:15px; line-height:24px; color:${BLACK};">
                We have looked at ${one ? 'the T-shirt' : 'the T-shirts'} from order
                ${escapeHtml(order.order_number)} and cannot put ${one ? 'it' : 'them'} back into stock,
                so we are not able to refund ${one ? 'it' : 'them'}.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${IVORY};">
                <tr>
                  <td style="padding:18px;">
                    <p style="margin:0 0 10px; font-family:${BODY_FONT}; font-size:10px; font-weight:600; letter-spacing:1.2px; color:${STONE};">
                      WHAT WE FOUND
                    </p>
                    ${findings}
                    <p style="margin:0; font-family:${BODY_FONT}; font-size:14px; line-height:21px; color:${BLACK};">
                      ${escapeHtml(reason)}
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">
                We are not keeping ${one ? 'it' : 'them'}. We will send ${one ? 'it' : 'them'} back to you
                and write again with the details &mdash; there is nothing you need to do.
              </p>
              <p style="margin:18px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE};">
                If you think we have got this wrong, reply to this email. A person reads every one of
                these and we would rather look again than leave you with a T-shirt you did not want.
              </p>
              <p style="margin:18px 0 0; font-family:${BODY_FONT}; font-size:13px; line-height:20px; color:${STONE}; border-top:1px solid ${SAND}; padding-top:18px;">
                You are receiving this because you asked to return part of an order. It is a service
                message, not marketing.
              </p>
            </td>
          </tr>`;

  const text = [
    'We could not accept this return.',
    '',
    `Return ${ret.return_number} on order ${order.order_number}.`,
    '',
    'What we found:',
    ...items.flatMap((i) =>
      [`- ${i.product_name} — ${i.colour} / ${i.size}`, i.condition ? `  ${i.condition}` : ''].filter(Boolean),
    ),
    reason,
    '',
    'We are not keeping it. We will send it back to you and write again with the details.',
    '',
    'If you think we have got this wrong, reply to this email. A person reads every one of these.',
  ].join('\n');

  // No CTA: there is no page that adds anything to this, and replying is the
  // route to challenge it.
  const html = renderEmailLayout({
    preheader: `About return ${ret.return_number} — we could not accept it.`,
    bodyHtml,
  });

  return { subject, html, text };
}

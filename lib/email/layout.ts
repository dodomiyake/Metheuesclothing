/**
 * Shared HTML chrome for the nine §14 transactional templates — see
 * "03 · Transactional Email" in docs/design-system-state.json.
 *
 * Table layout, inline styles throughout: Outlook renders through Word, which
 * ignores a <style> block and most of CSS with it. Nothing here should move to
 * a stylesheet no matter how repetitive it gets.
 *
 * The wordmark is plain text on a serif fallback stack, not the exported image
 * the design calls for — there is no asset pipeline yet (CLAUDE.md: blocked on
 * the owner). Swap the <td> below for an <img> once one exists; every client
 * that matters here already falls back past Bodoni Moda to the same serif
 * stack, so the text reads correctly in the meantime.
 */

const BODY_FONT =
  "ui-sans-serif, system-ui, 'Segoe UI', Helvetica, Arial, sans-serif";
const DISPLAY_FONT = "Didot, 'Times New Roman', Times, serif";

const BLACK = '#12100E';
const CREAM = '#FFFDF8';
const IVORY = '#F7F2E8';
const SAND = '#DDD4C7';
const STONE = '#68635D';

export function renderEmailLayout(opts: {
  /** Shown by the inbox before the subject is opened; never seen once open. */
  preheader: string;
  /** Body markup — already-built <tr> rows for the 600px content table. */
  bodyHtml: string;
  /** Rendered CTA button markup, or omitted for templates with nothing to do
   * (E5, E7 — see the design decisions in design-system-state.json). */
  ctaHtml?: string;
}): string {
  const { preheader, bodyHtml, ctaHtml = '' } = opts;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Metheues Clothings</title>
</head>
<body style="margin:0; padding:0; background-color:${IVORY};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${IVORY};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px; background-color:${CREAM};">
          <tr>
            <td align="center" style="background-color:${BLACK}; padding:28px 24px;">
              <span style="font-family:${DISPLAY_FONT}; font-size:20px; letter-spacing:2px; color:${CREAM}; text-transform:uppercase;">
                Metheues Clothings
              </span>
            </td>
          </tr>
          ${bodyHtml}
          ${ctaHtml}
          <tr>
            <td style="padding:24px 40px 32px; border-top:1px solid ${SAND};">
              <p style="margin:0 0 8px; font-family:${BODY_FONT}; font-size:12px; line-height:18px; color:${STONE};">
                Metheues Clothings &middot; hello@metheues.com
              </p>
              <p style="margin:0; font-family:${BODY_FONT}; font-size:12px; line-height:18px; color:${STONE};">
                You are receiving this email because it relates to an order placed at Metheues Clothings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderCta(label: string, href: string): string {
  return `<tr>
    <td align="center" style="padding:0 40px 32px;">
      <a href="${escapeHtml(href)}" style="display:inline-block; background-color:${BLACK}; color:${CREAM}; font-family:${BODY_FONT}; font-size:14px; font-weight:600; text-decoration:none; padding:14px 32px;">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>`;
}

export { BODY_FONT, DISPLAY_FONT, BLACK, CREAM, IVORY, SAND, STONE };

/** The only untrusted strings in an email are order data a customer typed
 * (a name, a delivery note) — escape before it reaches HTML. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

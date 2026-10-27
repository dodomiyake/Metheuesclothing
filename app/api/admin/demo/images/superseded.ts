/**
 * Photographs the demo seed is allowed to replace.
 *
 * TWO LISTS, because they identify two different things and the difference
 * is the whole safety argument.
 *
 * SUPERSEDED_FLAT_LAY_ALT names the first demo batch — flat-lay shots with
 * nobody in them, replaced when the owner asked for the garments to be
 * shown on a model. They are matched on their EXACT alt text, which is also
 * what `docs/demo-data/99-teardown.sql` matches on, and the guarantee is
 * narrow on purpose: a real photograph's description is not one of seven
 * string literals written in this repository, so a real photograph can
 * never be caught by it. Re-describe one in A05 and the swap stops finding
 * it, which is the safe direction to fail in.
 *
 * SUPERSEDED_IMAGE_IDS names ONE ROW, by id, and that row is a real upload
 * rather than a demo one — which is exactly why it needs naming rather than
 * matching. It is the striped polo's original photograph, and CLAUDE.md has
 * carried two findings about it since the day it went up: the garment is an
 * OVERSIZED RUGBY-STYLE polo where the product is a regular-fit short
 * sleeve polo, and it carries another brand's chest embroidery ("Young
 * Leaders", a globe motif and a line of smaller lettering). A product sold
 * under one name and pictured in another label's garment is a problem on
 * both the misrepresentation and the rights side, and it is now also the
 * only photograph in the shop that does not match the rest of the range.
 * The owner asked for it to be changed on 27 October.
 *
 * AN ID, NOT A PATTERN, and the reason matters more than the mechanism. A
 * heuristic that could reach a real photograph is a heuristic that will
 * eventually reach the wrong one. An id reaches exactly one row in exactly
 * one database and nothing else, ever — and when it is gone this constant
 * does nothing at all, which is the correct end state for it.
 */

export const SUPERSEDED_FLAT_LAY_ALT = [
  'A short sleeve polo shirt laid flat on a pale grey background, in even horizontal black and cream stripes, with a plain cream ribbed collar, matching cream cuffs and a two-button placket.',
  'A black oversized cotton T-shirt laid flat on a pale grey background, with a ribbed crew neck, dropped shoulder seams, short wide sleeves and a boxy body.',
  'An off-white oversized cotton T-shirt laid flat on a pale grey background, with a ribbed crew neck, dropped shoulder seams and a wide boxy body, the cotton showing a soft natural slub.',
  'A black long sleeve cotton T-shirt laid flat on a pale grey background with both sleeves extended, showing a ribbed crew neck and ribbed cuffs at each wrist.',
  'An off-white long sleeve cotton T-shirt laid flat on a pale grey background with both sleeves extended, showing a ribbed crew neck and ribbed cuffs at each wrist.',
  'A black short sleeve cotton T-shirt laid flat on a pale grey background, with a ribbed crew neck and a single plain patch pocket stitched on the left chest.',
  'An off-white short sleeve cotton T-shirt laid flat on a pale grey background, with a ribbed crew neck and a single plain patch pocket stitched on the left chest.',
];

/** The striped polo's original photograph — see the note above. */
export const SUPERSEDED_IMAGE_IDS = ['0dae3104-e571-4009-b1b7-bf7647a4d76d'];

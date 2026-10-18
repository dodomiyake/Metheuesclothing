/**
 * "Visa ending 4242", or the honest fallback.
 *
 * payments.card_brand and .card_last4 have existed since migration 001 and
 * were written by nothing until the Stripe webhook started expanding
 * latest_charge. So two kinds of order exist and always will: ones paid
 * after that, which know their card, and every order placed before it,
 * which never will — Stripe has the detail, our row does not, and
 * backfilling means a dashboard trawl nobody has asked for.
 *
 * One helper rather than six copies, because the FALLBACK wording is the
 * thing most likely to drift. A12, A15, A16, E5, E7 and E8 all say it, and
 * "the card that paid" reads correctly in every one of those sentences
 * where "your card" does not.
 */
const BRAND_NAMES: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay',
  eftpos_au: 'Eftpos',
  link: 'Link',
};

/** The card as a noun phrase: "the Visa ending 4242" / "the card that paid". */
export function cardLabel(
  brand: string | null | undefined,
  last4: string | null | undefined,
): string {
  const named = cardName(brand, last4);
  return named ? `the ${named}` : 'the card that paid';
}

/** The card without the article, for a label-and-value row: "Visa ending 4242". */
export function cardName(
  brand: string | null | undefined,
  last4: string | null | undefined,
): string | null {
  if (!last4) return null;
  const name = brand ? (BRAND_NAMES[brand] ?? titleCase(brand)) : 'Card';
  return `${name} ending ${last4}`;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The same thing addressed to the customer. "your Visa ending 4242" where
 * the card is known, "the card you paid with" where it is not — second
 * person, because these go in E5, E7 and E8 rather than on a staff screen.
 */
export function customerCardLabel(
  brand: string | null | undefined,
  last4: string | null | undefined,
): string {
  const named = cardName(brand, last4);
  return named ? `your ${named}` : 'the card you paid with';
}

/** Title case for a "Back to" row: "Visa ending 4242" / "The card you paid with". */
export function customerCardRow(
  brand: string | null | undefined,
  last4: string | null | undefined,
): string {
  return cardName(brand, last4) ?? 'The card you paid with';
}

/** What the payments row carries, where it carries anything. */
export type PaymentCard = { card_brand: string | null; card_last4: string | null } | null;

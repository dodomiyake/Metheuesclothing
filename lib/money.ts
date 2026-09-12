/**
 * Money is integer pence everywhere. 28400 is £284.00.
 * These are the only two functions that should ever convert between the two.
 */
export function formatPence(pence: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(pence / 100);
}

/** For parsing admin input like "68.00" or "£68". Rounds, never truncates. */
export function parsePounds(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned) throw new Error('Not a number');
  return Math.round(parseFloat(cleaned) * 100);
}

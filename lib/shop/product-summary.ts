const NEW_WITHIN_DAYS = 14;

export type SummaryVariant = {
  colour: string;
  size: string;
  price_pence: number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
};

export type ProductSummary = {
  minPrice: number;
  colours: string[];
  inStock: boolean;
  lowStock: boolean;
  isNew: boolean;
  isLimitedEdition: boolean;
};

/**
 * Shared between the shop listing and product detail's "More from the
 * drop" -- both need the same New/Limited Edition/Low stock/Sold out
 * derivation from real data (published_at, collection membership,
 * stock_quantity vs low_stock_threshold), and it must stay identical or
 * the same product could show different availability in two places.
 */
export function summarizeProduct(
  publishedAt: string | null,
  variants: SummaryVariant[],
  collectionNames: string[],
): ProductSummary {
  const active = variants.filter((v) => v.is_active);
  const colours = [...new Set(active.map((v) => v.colour))];
  const minPrice = active.length ? Math.min(...active.map((v) => v.price_pence)) : 0;
  const inStock = active.some((v) => v.stock_quantity > 0);
  const lowStock = inStock && active.every((v) => v.stock_quantity === 0 || v.stock_quantity <= v.low_stock_threshold);
  const isNew = publishedAt ? Date.now() - new Date(publishedAt).getTime() <= NEW_WITHIN_DAYS * 24 * 60 * 60 * 1000 : false;
  const isLimitedEdition = collectionNames.some((c) => c.toLowerCase().includes('limited'));

  return { minPrice, colours, inStock, lowStock, isNew, isLimitedEdition };
}

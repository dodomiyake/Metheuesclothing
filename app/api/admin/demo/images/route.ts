import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { fetchImageToBucket, attachProductImage, imagePaths } from '@/lib/admin/image-import';

export const runtime = 'nodejs';

/**
 * Put the bundled demo photographs into this shop's storage.
 *
 * WHY A ROUTE AND NOT A SCRIPT. Migration 019's storage policies are gated
 * on `is_staff()`, and the sessions that built this have no staff
 * credential — no service-role key, no admin password, and the publishable
 * key does not satisfy the policy. So the files ship in `public/demo/` and a
 * staff member presses a button once. That is the same courier shape the
 * stock photo import uses, and it keeps the storage policy doing its job
 * rather than being routed around.
 *
 * THE SOURCE IS THIS DEPLOYMENT'S OWN ORIGIN, which is the whole reason this
 * is safe to point at a URL at all. `fetchImageToBucket` deliberately does
 * not judge whether a URL is acceptable, because only the caller knows: the
 * stock import checks an allow-list of provider CDNs, and here the only
 * permitted source is a fixed file name appended to our own origin. Nothing
 * from the request body reaches the fetch.
 *
 * IT ONLY FILLS PRODUCTS THAT HAVE NO PHOTOGRAPHS. Running it twice does
 * nothing the second time, and more importantly it can never push a real
 * photograph down the running order or sit beside one. The moment the owner
 * uploads actual product photography, this route stops touching that
 * product.
 *
 * EVERY ALT TEXT BELOW WAS WRITTEN FROM THE IMAGE, not from the prompt that
 * made it. `product_images.alt_text` is NOT NULL with a non-empty check
 * precisely so that §13 is enforced by the database rather than by a code
 * review, and this shop has already shipped lorem ipsum and a repeated
 * product name into that column. A description generated alongside the
 * picture would be the same mistake with better grammar.
 *
 * THESE ARE GENERATED IMAGES AND THE SHOP IS PRE-SUPPLIER. They exist so the
 * app can be seen working end to end with a populated catalogue, and they
 * are listed in `docs/real-data-needed.md` as the first thing real
 * photography replaces. `docs/demo-data/99-teardown.sql` removes the rows.
 */

type DemoImage = {
  file: string;
  slug: string;
  colour: string;
  alt: string;
};

const PRODUCT_IMAGES: DemoImage[] = [
  {
    file: 'polo-black.jpg',
    slug: 'striped-short-sleeve-polo-tshirt',
    colour: 'BLACK',
    alt: 'A short sleeve polo shirt laid flat on a pale grey background, in even horizontal black and cream stripes, with a plain cream ribbed collar, matching cream cuffs and a two-button placket.',
  },
  {
    file: 'oversized-black.jpg',
    slug: 'oversized-crew-neck-tshirt',
    colour: 'BLACK',
    alt: 'A black oversized cotton T-shirt laid flat on a pale grey background, with a ribbed crew neck, dropped shoulder seams, short wide sleeves and a boxy body.',
  },
  {
    file: 'oversized-bone.jpg',
    slug: 'oversized-crew-neck-tshirt',
    colour: 'BONE',
    alt: 'An off-white oversized cotton T-shirt laid flat on a pale grey background, with a ribbed crew neck, dropped shoulder seams and a wide boxy body, the cotton showing a soft natural slub.',
  },
  {
    file: 'longsleeve-black.jpg',
    slug: 'long-sleeve-crew-neck-tshirt',
    colour: 'BLACK',
    alt: 'A black long sleeve cotton T-shirt laid flat on a pale grey background with both sleeves extended, showing a ribbed crew neck and ribbed cuffs at each wrist.',
  },
  {
    file: 'longsleeve-bone.jpg',
    slug: 'long-sleeve-crew-neck-tshirt',
    colour: 'BONE',
    alt: 'An off-white long sleeve cotton T-shirt laid flat on a pale grey background with both sleeves extended, showing a ribbed crew neck and ribbed cuffs at each wrist.',
  },
  {
    file: 'pocket-black.jpg',
    slug: 'relaxed-fit-pocket-tshirt',
    colour: 'BLACK',
    alt: 'A black short sleeve cotton T-shirt laid flat on a pale grey background, with a ribbed crew neck and a single plain patch pocket stitched on the left chest.',
  },
  {
    file: 'pocket-bone.jpg',
    slug: 'relaxed-fit-pocket-tshirt',
    colour: 'BONE',
    alt: 'An off-white short sleeve cotton T-shirt laid flat on a pale grey background, with a ribbed crew neck and a single plain patch pocket stitched on the left chest.',
  },
];

const COLLECTION_HEROES = [
  { file: 'hero-core.jpg', slug: 'core' },
  { file: 'hero-oversized.jpg', slug: 'oversized-edit' },
];

export async function POST(req: NextRequest) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const origin = req.nextUrl.origin;
  const added: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  // ---------------------------------------------------------- products
  const { data: products, error: productError } = await session.supabase
    .from('products')
    .select('id, slug')
    .in('slug', [...new Set(PRODUCT_IMAGES.map((i) => i.slug))]);

  if (productError) {
    return NextResponse.json(
      { error: `Could not read the catalogue: ${productError.message}` },
      { status: 500 },
    );
  }

  const idBySlug = new Map((products ?? []).map((p) => [p.slug as string, p.id as string]));

  // Which products already have photography. A product with even one image
  // is left completely alone — see the note above.
  const { data: existing, error: existingError } = await session.supabase
    .from('product_images')
    .select('product_id')
    .in('product_id', [...idBySlug.values()]);

  if (existingError) {
    return NextResponse.json(
      { error: `Could not read existing images: ${existingError.message}` },
      { status: 500 },
    );
  }

  const photographed = new Set((existing ?? []).map((r) => r.product_id as string));

  for (const image of PRODUCT_IMAGES) {
    const productId = idBySlug.get(image.slug);
    if (!productId) {
      skipped.push(`${image.file} (no product ${image.slug})`);
      continue;
    }
    if (photographed.has(productId)) {
      skipped.push(`${image.file} (${image.slug} already has photography)`);
      continue;
    }

    const stored = await fetchImageToBucket({
      supabase: session.supabase,
      url: `${origin}/demo/${image.file}`,
      pathFor: imagePaths.product(productId),
      sourceLabel: 'the bundled demo images',
    });
    if (!stored.ok) {
      failed.push(`${image.file}: ${stored.error}`);
      continue;
    }

    const attached = await attachProductImage({
      supabase: session.supabase,
      productId,
      storagePath: stored.path,
      altText: image.alt,
      colour: image.colour,
    });
    if (!attached.ok) {
      failed.push(`${image.file}: ${attached.error}`);
      continue;
    }

    added.push(`${image.slug} / ${image.colour}`);
  }

  // ------------------------------------------------------- collections
  // A hero is a single path on the collection row rather than a child
  // table, so "already has one" is simply the column being set.
  const { data: collections, error: collectionError } = await session.supabase
    .from('collections')
    .select('id, slug, hero_path')
    .in('slug', COLLECTION_HEROES.map((h) => h.slug));

  if (collectionError) {
    return NextResponse.json(
      { error: `Could not read collections: ${collectionError.message}` },
      { status: 500 },
    );
  }

  for (const hero of COLLECTION_HEROES) {
    const row = (collections ?? []).find((c) => c.slug === hero.slug);
    if (!row) {
      skipped.push(`${hero.file} (no collection ${hero.slug})`);
      continue;
    }
    if (row.hero_path) {
      skipped.push(`${hero.file} (${hero.slug} already has a hero)`);
      continue;
    }

    const stored = await fetchImageToBucket({
      supabase: session.supabase,
      url: `${origin}/demo/${hero.file}`,
      pathFor: imagePaths.collection(row.id as string),
      sourceLabel: 'the bundled demo images',
    });
    if (!stored.ok) {
      failed.push(`${hero.file}: ${stored.error}`);
      continue;
    }

    // The path goes on the row LAST, the opposite order from a delete:
    // an uploaded file nothing points at costs storage, while a row
    // pointing at a file that is not there is a broken image on the shop.
    const { error: updateError } = await session.supabase
      .from('collections')
      .update({ hero_path: stored.path })
      .eq('id', row.id);

    if (updateError) {
      failed.push(`${hero.file}: uploaded but the collection was not updated.`);
      continue;
    }

    added.push(`collection ${hero.slug} hero`);
  }

  return NextResponse.json({ added, skipped, failed });
}

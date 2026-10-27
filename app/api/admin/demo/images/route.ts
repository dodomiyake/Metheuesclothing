import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { fetchImageToBucket, attachProductImage, imagePaths } from '@/lib/admin/image-import';
import { SHOP_BUCKET } from '@/lib/images';
import { SUPERSEDED_FLAT_LAY_ALT, SUPERSEDED_IMAGE_IDS } from './superseded';

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
 * from the request body reaches the fetch — `action` is the only thing read
 * off it and it is one of two literals.
 *
 * IT ONLY FILLS PRODUCTS WHOSE EVERY PHOTOGRAPH IT PUT THERE ITSELF, and a
 * colourway it has already filled is never filled twice. So running it
 * again does nothing, and it can never push a real photograph down the
 * running order or sit beside one. The moment the owner uploads actual
 * product photography — or re-describes one of these in A05 — this route
 * stops touching that product. The per-colourway loop below carries the
 * full reasoning.
 *
 * THE SECOND ACTION EXISTS BECAUSE THAT GUARD IS TOO BLUNT FOR ONE CASE.
 * The first demo batch was FLAT-LAY photography, deliberately with no people
 * in it. The owner has since asked for a model wearing the garments, which
 * is a different call and theirs to make — but the four products that got
 * flat-lays are now photographed, so `fill` will never touch them again and
 * the shop would show four flat-lays beside eight model shots for good.
 * `swap-to-models` removes the superseded rows and then fills. What counts
 * as superseded is in `superseded.ts`, which carries the reasoning for both
 * halves: seven bundled flat-lays matched on their exact alt text, and ONE
 * real upload named by id because it pictures another brand's garment. The
 * split is the safety argument — a pattern must never be able to reach a
 * real photograph, so the one real photograph that has to go is named
 * rather than matched.
 *
 * EVERY ALT TEXT BELOW WAS WRITTEN FROM THE IMAGE, not from the prompt that
 * made it. `product_images.alt_text` is NOT NULL with a non-empty check
 * precisely so that §13 is enforced by the database rather than by a code
 * review, and this shop has already shipped lorem ipsum and a repeated
 * product name into that column. A description generated alongside the
 * picture would be the same mistake with better grammar. All twenty were
 * opened and looked at: the striped long sleeve in black has visibly
 * narrower stripes than the navy, and the description says so rather than
 * reusing one sentence for both.
 *
 * THESE ARE GENERATED IMAGES AND THE SHOP IS PRE-SUPPLIER. They exist so the
 * app can be seen working end to end with a populated catalogue, and they
 * are listed in `docs/real-data-needed.md` as the first thing real
 * photography replaces. The people in them do not exist, which is a thing
 * the dashboard notice says out loud rather than leaving to be noticed.
 * `docs/demo-data/99-teardown.sql` removes the rows.
 */

type DemoImage = {
  file: string;
  slug: string;
  colour: string;
  alt: string;
};

const PRODUCT_IMAGES: DemoImage[] = [
  // ------------------------------------------------- the original four
  {
    file: 'model-polo-navy.jpg',
    slug: 'striped-short-sleeve-polo-tshirt',
    colour: 'NAVY',
    alt: 'A man stands facing the camera against a plain warm-grey studio wall, wearing a short sleeve polo shirt in broad even horizontal stripes of navy and cream, with a plain cream collar and a two-button placket, over grey trousers and white trainers.',
  },
  {
    file: 'model-polo-black.jpg',
    slug: 'striped-short-sleeve-polo-tshirt',
    colour: 'BLACK',
    alt: 'A woman stands facing the camera against a plain warm-grey studio wall, wearing a short sleeve polo shirt in broad even horizontal stripes of black and cream, with a plain cream collar, cream cuffs and a two-button placket, over grey trousers and white trainers.',
  },
  {
    file: 'model-oversized-black.jpg',
    slug: 'oversized-crew-neck-tshirt',
    colour: 'BLACK',
    alt: 'A man stands facing the camera against a plain warm-grey studio wall, wearing a plain black oversized T-shirt whose shoulder seams sit well down the upper arm and whose body hangs wide and straight, over grey trousers and white trainers.',
  },
  {
    file: 'model-pocket-bone.jpg',
    slug: 'relaxed-fit-pocket-tshirt',
    colour: 'BONE',
    alt: 'A woman stands facing the camera against a plain warm-grey studio wall, wearing a loose off-white short sleeve T-shirt with a ribbed crew neck and a single square patch pocket on the left chest, over dark grey trousers and white trainers.',
  },
  {
    file: 'model-longsleeve-black.jpg',
    slug: 'long-sleeve-crew-neck-tshirt',
    colour: 'BLACK',
    alt: 'A woman stands facing the camera against a plain warm-grey studio wall, wearing a plain black long sleeve T-shirt with a ribbed crew neck and sleeves reaching the wrist, over cream trousers and white trainers.',
  },
  {
    file: 'model-oversized-bone.jpg',
    slug: 'oversized-crew-neck-tshirt',
    colour: 'BONE',
    alt: 'A woman stands facing the camera against a plain warm-grey studio wall, wearing a plain off-white oversized T-shirt with dropped shoulder seams, wide short sleeves and a body that hangs straight past the hip, over dark grey trousers and white trainers.',
  },
  {
    file: 'model-longsleeve-bone.jpg',
    slug: 'long-sleeve-crew-neck-tshirt',
    colour: 'BONE',
    alt: 'A man stands facing the camera against a plain warm-grey studio wall, wearing a plain off-white long sleeve T-shirt with a ribbed crew neck and ribbed cuffs gathered at each wrist, over grey trousers and white trainers.',
  },
  {
    file: 'model-pocket-black.jpg',
    slug: 'relaxed-fit-pocket-tshirt',
    colour: 'BLACK',
    alt: 'A man stands facing the camera against a plain warm-grey studio wall, wearing a loose black short sleeve T-shirt with a ribbed crew neck and a single square patch pocket on the left chest, over grey trousers and white trainers.',
  },

  // ------------------------------------------------------ the new eight
  {
    file: 'model-classic-black.jpg',
    slug: 'classic-crew-neck-tshirt',
    colour: 'BLACK',
    alt: 'A man stands facing the camera against a plain warm-grey studio wall, wearing a plain black short sleeve T-shirt with a ribbed crew neck and sleeves ending mid upper arm, cut straight through the body, over grey trousers and white trainers.',
  },
  {
    file: 'model-classic-white.jpg',
    slug: 'classic-crew-neck-tshirt',
    colour: 'WHITE',
    alt: 'A woman stands facing the camera against a plain warm-grey studio wall, wearing a plain white short sleeve T-shirt with a ribbed crew neck, cut straight through the body, over mid-grey trousers and white trainers.',
  },
  {
    file: 'model-vneck-black.jpg',
    slug: 'v-neck-tshirt',
    colour: 'BLACK',
    alt: 'A bearded man stands facing the camera against a plain warm-grey studio wall, wearing a plain black short sleeve T-shirt with a shallow V neckline that stops a little below the collarbone, over grey trousers and white trainers.',
  },
  {
    file: 'model-vneck-navy.jpg',
    slug: 'v-neck-tshirt',
    colour: 'NAVY',
    alt: 'A woman stands facing the camera against a plain warm-grey studio wall, wearing a plain dark navy short sleeve T-shirt with a shallow V neckline, over cream trousers and white trainers.',
  },
  {
    file: 'model-henley-bone.jpg',
    slug: 'short-sleeve-henley-tshirt',
    colour: 'BONE',
    alt: 'A man stands facing the camera against a plain warm-grey studio wall, wearing an off-white short sleeve T-shirt with no collar and a short buttoned opening of three small buttons at the centre of the chest, over dark grey trousers and white trainers.',
  },
  {
    file: 'model-henley-sand.jpg',
    slug: 'short-sleeve-henley-tshirt',
    colour: 'SAND',
    alt: 'A woman stands facing the camera against a plain warm-grey studio wall, wearing a warm beige short sleeve T-shirt with no collar and a short buttoned opening of three small buttons at the centre of the chest, over black trousers and white trainers.',
  },
  {
    file: 'model-plainpolo-black.jpg',
    slug: 'plain-short-sleeve-polo-tshirt',
    colour: 'BLACK',
    alt: 'A man stands facing the camera against a plain warm-grey studio wall, wearing a plain black short sleeve polo shirt with a fold-down collar and a two-button placket, in a knit with a faint waffle texture, over grey trousers and white trainers.',
  },
  {
    file: 'model-plainpolo-sage.jpg',
    slug: 'plain-short-sleeve-polo-tshirt',
    colour: 'SAGE',
    alt: 'A woman stands facing the camera against a plain warm-grey studio wall, wearing a plain muted grey-green short sleeve polo shirt with a fold-down collar and a two-button placket, over cream trousers and white trainers.',
  },
  {
    file: 'model-lspolo-navy.jpg',
    slug: 'long-sleeve-polo-tshirt',
    colour: 'NAVY',
    alt: 'A man stands facing the camera against a plain warm-grey studio wall, wearing a plain dark navy polo shirt with full-length sleeves gathered into ribbed cuffs, a fold-down collar and a two-button placket, over grey trousers and white trainers.',
  },
  {
    file: 'model-lspolo-bone.jpg',
    slug: 'long-sleeve-polo-tshirt',
    colour: 'BONE',
    alt: 'A woman stands facing the camera against a plain warm-grey studio wall, wearing a plain off-white polo shirt with full-length sleeves, a fold-down collar and a two-button placket, over dark grey trousers and white trainers.',
  },
  {
    file: 'model-vest-black.jpg',
    slug: 'ribbed-sleeveless-vest-tshirt',
    colour: 'BLACK',
    alt: 'A man stands facing the camera against a plain warm-grey studio wall, wearing a close-fitting black sleeveless ribbed vest with narrow shoulder straps, a high-cut armhole and a shallow rounded neckline, over grey trousers and white trainers.',
  },
  {
    file: 'model-vest-white.jpg',
    slug: 'ribbed-sleeveless-vest-tshirt',
    colour: 'WHITE',
    alt: 'A woman stands facing the camera against a plain warm-grey studio wall, wearing a close-fitting white sleeveless ribbed vest with narrow shoulder straps and a shallow rounded neckline, over black trousers and white trainers.',
  },
  {
    file: 'model-tank-black.jpg',
    slug: 'tank-top-tshirt',
    colour: 'BLACK',
    alt: 'A man stands facing the camera against a plain warm-grey studio wall, wearing a loose black sleeveless top in smooth flat cotton with wide shoulder straps and an armhole cut low towards the waist, over grey trousers and white trainers.',
  },
  {
    file: 'model-tank-rust.jpg',
    slug: 'tank-top-tshirt',
    colour: 'RUST',
    alt: 'A woman stands facing the camera against a plain warm-grey studio wall, wearing a loose burnt orange sleeveless top in smooth flat cotton with wide shoulder straps and a rounded neckline, over cream trousers and white trainers.',
  },
  {
    file: 'model-stripedls-navy.jpg',
    slug: 'striped-long-sleeve-tshirt',
    colour: 'NAVY',
    alt: 'A man stands facing the camera against a plain warm-grey studio wall, wearing a long sleeve T-shirt in broad horizontal navy and cream stripes that continue the full length of both sleeves, with a plain navy crew neck, over grey trousers and white trainers.',
  },
  {
    file: 'model-stripedls-black.jpg',
    slug: 'striped-long-sleeve-tshirt',
    colour: 'BLACK',
    alt: 'A woman stands facing the camera against a plain warm-grey studio wall, wearing a long sleeve T-shirt in fine horizontal black and cream stripes, narrower than the navy colourway, continuing the full length of both sleeves, with a plain black crew neck, over black trousers and white trainers.',
  },
];

const COLLECTION_HEROES = [
  { file: 'hero-core.jpg', slug: 'core' },
  { file: 'hero-oversized.jpg', slug: 'oversized-edit' },
];

export async function POST(req: NextRequest) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  // The only thing read off the body, and it is one of two literals.
  // Anything else is treated as the safe default rather than rejected,
  // because the two buttons on /admin/demo are the only callers.
  const body = await req.json().catch(() => null);
  const swapToModels = (body as { action?: string } | null)?.action === 'swap-to-models';

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

  // ------------------------------------------ remove the superseded flat-lays
  // Only when asked. The ROW goes first and the file after, the same order
  // A05's delete uses: an orphaned file costs storage, while a row pointing
  // at a deleted file is a broken image on the shop.
  if (swapToModels) {
    // Two queries rather than one `or`, because they are two different
    // claims: "this is a demo flat-lay" and "this is the one named row".
    // PostgREST can express the union, but a single filter string would
    // hide which half matched when something goes wrong.
    const [byAlt, byId] = await Promise.all([
      session.supabase
        .from('product_images')
        .select('id, storage_path')
        .in('alt_text', SUPERSEDED_FLAT_LAY_ALT),
      session.supabase
        .from('product_images')
        .select('id, storage_path')
        .in('id', SUPERSEDED_IMAGE_IDS),
    ]);

    const staleError = byAlt.error ?? byId.error;
    if (staleError) {
      return NextResponse.json(
        { error: `Could not read the existing photographs: ${staleError.message}` },
        { status: 500 },
      );
    }

    const seen = new Set<string>();
    const stale = [...(byAlt.data ?? []), ...(byId.data ?? [])].filter((r) => {
      const id = r.id as string;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    for (const row of stale) {
      const { error: deleteError } = await session.supabase
        .from('product_images')
        .delete()
        .eq('id', row.id);

      if (deleteError) {
        failed.push(`A flat-lay could not be removed: ${deleteError.message}`);
        continue;
      }

      // Best effort. A file left behind is invisible to customers and
      // costs a few kilobytes; saying nothing about a failed ROW delete
      // would have been the real problem, and that is handled above.
      await session.supabase.storage.from(SHOP_BUCKET).remove([row.storage_path as string]);
      added.push('removed a superseded photograph');
    }

    if (stale.length === 0) {
      skipped.push('No superseded photographs are left to replace.');
    }
  }

  // What each product already has. The alt text comes back too, because it
  // is what tells a demo photograph from a real one — every description
  // this route writes is a literal in PRODUCT_IMAGES above, and a person
  // writing their own will not reproduce one by accident.
  const { data: existing, error: existingError } = await session.supabase
    .from('product_images')
    .select('product_id, colour, alt_text')
    .in('product_id', [...idBySlug.values()]);

  if (existingError) {
    return NextResponse.json(
      { error: `Could not read existing images: ${existingError.message}` },
      { status: 500 },
    );
  }

  const demoAlt = new Set(PRODUCT_IMAGES.map((i) => i.alt));
  const held = new Map<string, { colour: string | null; alt: string }[]>();
  for (const row of existing ?? []) {
    const id = row.product_id as string;
    if (!held.has(id)) held.set(id, []);
    held.get(id)!.push({
      colour: (row.colour as string | null) ?? null,
      alt: (row.alt_text as string) ?? '',
    });
  }

  /**
   * THE GUARD IS PER COLOURWAY NOW, NOT PER PRODUCT, and the part it keeps
   * is the part that matters: a demo photograph must never sit beside a
   * real one.
   *
   * The original rule was "a product with even one image is left completely
   * alone". That is right about real photography and wrong about this
   * route's own output — it meant a product that had received ONE demo shot
   * could never receive its second colourway, so three products ended up
   * with a single photograph and a gallery that does not swap when the
   * colour changes, while the other nine swap.
   *
   * So the test is no longer "has anything" but "has anything this route
   * did not put there". If every photograph on a product is one of ours, a
   * missing colourway can still be filled. The moment a human uploads
   * something — or re-describes one of ours in A05, which is the same
   * signal — the product goes back to being left alone for good.
   */
  for (const image of PRODUCT_IMAGES) {
    const productId = idBySlug.get(image.slug);
    if (!productId) {
      skipped.push(`${image.file} (no product ${image.slug})`);
      continue;
    }

    const rows = held.get(productId) ?? [];
    if (rows.some((r) => !demoAlt.has(r.alt))) {
      skipped.push(`${image.file} (${image.slug} has its own photography)`);
      continue;
    }
    if (rows.some((r) => r.colour === image.colour)) {
      skipped.push(`${image.file} (${image.slug} / ${image.colour} is already there)`);
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

    // Recorded as we go, so the second colourway of the same product sees
    // the first — the snapshot above was taken before this loop ran.
    held.set(productId, [...(held.get(productId) ?? []), { colour: image.colour, alt: image.alt }]);
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

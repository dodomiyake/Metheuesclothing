import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';

/**
 * The collections index.
 *
 * THERE IS NO FIGMA FRAME FOR THIS SCREEN, and it is built anyway for the
 * same reason track-order was: something already points at it. The site
 * header has linked "Collections" to /collections since the chrome was
 * built (components/site/header.tsx), and that link has 404'd ever since;
 * screen 19's breadcrumb reads "Home / Collections / The First Drop", which
 * names a page between the two. A link in the primary navigation that goes
 * nowhere is worse than a plain index.
 *
 * So it is deliberately plain, and built only from parts that already exist
 * — the listing head from 03/19 and a row per collection carrying exactly
 * what screen 19 shows in its own head. Nothing here is invented: name,
 * description and published_at are columns, and the count is the real
 * number of published products in each one. If the design owner draws this
 * screen later it should replace this wholesale rather than be reconciled
 * with it.
 *
 * Only live collections appear, and not because this filters them: the RLS
 * policy is `status = 'live' or is_staff()` (002_rls.sql:88), so a hidden
 * or scheduled collection is not returned to a customer at all. See the
 * collection page's own note — the design says a hidden collection's page
 * stays reachable, and the database disagrees.
 */
export default async function CollectionsIndexPage() {
  const supabase = await createServerComponentClient();

  const { data: collections, error } = await supabase
    .from('collections')
    .select('id, slug, name, description, published_at')
    .order('position');
  if (error) throw new Error(`Could not load collections: ${error.message}`);

  const ids = (collections ?? []).map((c) => c.id as string);

  // Counting published products per collection needs the join table and the
  // products' own status, and PostgREST cannot GROUP BY — but this is a
  // handful of rows on a page with no pagination, so two queries and a Map
  // is honest here in a way it was not for A19's customer list.
  const { data: links, error: linksError } = ids.length
    ? await supabase.from('product_collections').select('collection_id, product_id').in('collection_id', ids)
    : { data: [] as { collection_id: string; product_id: string }[], error: null };
  if (linksError) throw new Error(`Could not load collection membership: ${linksError.message}`);

  const memberIds = [...new Set((links ?? []).map((l) => l.product_id as string))];
  const { data: published, error: publishedError } = memberIds.length
    ? await supabase.from('products').select('id').eq('status', 'published').in('id', memberIds)
    : { data: [] as { id: string }[], error: null };
  if (publishedError) throw new Error(`Could not load products: ${publishedError.message}`);

  const publishedIds = new Set((published ?? []).map((p) => p.id as string));
  const counts = new Map<string, number>();
  for (const l of links ?? []) {
    if (!publishedIds.has(l.product_id as string)) continue;
    counts.set(l.collection_id as string, (counts.get(l.collection_id as string) ?? 0) + 1);
  }

  return (
    <main style={{ fontFamily: 'var(--mc-font-body)' }}>
      <div
        className="mc-page-gutter"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          paddingTop: 'var(--mc-space-xl)',
          paddingBottom: 'var(--mc-space-lg)',
        }}
      >
        <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
          <Link href="/" style={{ color: 'inherit' }}>
            Home
          </Link>{' '}
          / Collections
        </p>
        <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)', margin: 0 }}>
          Collections
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--mc-text-muted)', maxWidth: 620, margin: 0 }}>
          Drops and ranges, each made once. A T-shirt can belong to more than one.
        </p>
      </div>

      <div className="mc-page-gutter" style={{ paddingBottom: 80 }}>
        {!collections?.length ? (
          <p style={{ color: 'var(--mc-text-muted)' }}>
            No collections yet. Everything is on{' '}
            <Link href="/shop" style={{ color: 'var(--mc-text-primary)' }}>
              the T-shirts page
            </Link>{' '}
            in the meantime.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {collections.map((c, i) => {
              const count = counts.get(c.id as string) ?? 0;
              return (
                <Link
                  key={c.id as string}
                  href={`/collections/${c.slug}`}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                    gap: '4px 16px',
                    padding: '24px 0',
                    borderTop: i === 0 ? undefined : '1px solid var(--mc-border-default)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ flex: '1 0 0', minWidth: 240, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--mc-font-display)', fontSize: 28 }}>{c.name}</span>
                    {c.description && (
                      <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--mc-text-muted)', maxWidth: 560 }}>
                        {c.description}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--mc-text-muted)', whiteSpace: 'nowrap' }}>
                    {count} T-shirt{count === 1 ? '' : 's'}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { WideOnly } from '@/components/admin/wide-only';
import { imageUrl } from '@/lib/images';
import { CollectionsList, type CollectionRow } from './collections-list';

/**
 * A09 Collections — Figma 145:2426 (Desktop pulled) / 145:2294 (Tablet).
 *
 * NO MOBILE FRAME, and now that is a recorded decision rather than an
 * inference: design-system-state.json's `admin_breakpoint_decision` lists
 * A09 and A10 among sixteen no_mobile screens, for a reason the owner gave
 * on 10 September — dense tables and multi-section editors fight a 390px
 * screen. This one is a drag-ordered list with an editor behind every row,
 * so it sits behind WideOnly like A13 and A18.
 *
 * THE SCREEN ONLY BECAME HONEST LAST COMMIT. Until screen 19 existed,
 * everything this page edits reached no reader: there was no collection
 * page, no /collections, and `position`, `hero_*` and the SEO columns were
 * written by nothing and read by nothing. The order set here is now the
 * order of the collections index, and each row's Edit leads to fields the
 * storefront actually renders.
 *
 * Three narrowings, all for the same reason — the design describes a
 * navigation menu built from collections, and there is no such menu:
 *
 *  - "drag to set the order they appear in the menu" becomes the order they
 *    appear on the collections page. The header's Collections link is one
 *    static item, not a list of them.
 *  - "Hidden from navigation" becomes "Hidden from the shop", because a
 *    hidden collection is not returned to a customer at all.
 *  - The note's "hiding a collection takes it out of the menu but its page
 *    stays reachable by its address, so links you have already shared keep
 *    working" is the one claim that is actually CONTRADICTED rather than
 *    just unsupported. The RLS policy is `status = 'live' or is_staff()`
 *    (002_rls.sql:88): a hidden collection's page 404s for a customer. The
 *    note says what the system does. Worth settling with the design owner —
 *    keeping shared links alive is a reasonable thing to want, and it is a
 *    policy change, not a copy change.
 *
 * Kept exactly: "a T-shirt can sit in more than one collection" and
 * "removing it from a collection does not unpublish it". Both are true —
 * product_collections is a join table, and removing a row there touches
 * nothing on `products`.
 */
export default async function AdminCollectionsPage() {
  const supabase = await createServerComponentClient();

  const { data: collections, error } = await supabase
    .from('collections')
    .select('id, slug, name, status, hero_path, published_at, position')
    .order('position');
  if (error) throw new Error(`Could not load collections: ${error.message}`);

  const ids = (collections ?? []).map((c) => c.id as string);

  // Counts come from the join table, not from a GROUP BY PostgREST cannot
  // express. A handful of collections and one query each way is honest at
  // this size; A19's customer list is where that stopped being true.
  const { data: links, error: linksError } = ids.length
    ? await supabase.from('product_collections').select('collection_id').in('collection_id', ids)
    : { data: [] as { collection_id: string }[], error: null };
  if (linksError) throw new Error(`Could not count collection members: ${linksError.message}`);

  const counts = new Map<string, number>();
  for (const l of links ?? []) {
    const k = l.collection_id as string;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const rows: CollectionRow[] = (collections ?? []).map((c) => ({
    id: c.id as string,
    slug: c.slug as string,
    name: c.name as string,
    status: c.status as string,
    published_at: (c.published_at as string | null) ?? null,
    heroUrl: imageUrl(c.hero_path as string | null),
    productCount: counts.get(c.id as string) ?? 0,
  }));

  const scheduled = rows.filter((r) => r.status === 'scheduled').length;

  return (
    <WideOnly title="Collections">
      <div className="mc-admin-page">
        <div className="mc-admin-topbar">
          <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
              Collections
            </h1>
            <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
              {subtitle(rows.length, scheduled)}
            </p>
          </div>
          {/* Primary button (9:2) — one per view, the thing you want done. */}
          <Link
            href="/admin/collections/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
              padding: '14px 24px',
              background: 'var(--mc-action-primary-bg)',
              color: 'var(--mc-action-primary-text)',
              borderRadius: 'var(--mc-radius-sm)',
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '0.32px',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            New collection
          </Link>
        </div>

        <div className="mc-admin-content">
          <CollectionsList rows={rows} />

          {/* 145:2568 — the Ivory note. */}
          <section
            style={{
              background: 'var(--mc-bg-page)',
              border: '1px solid var(--mc-border-default)',
              borderRadius: 'var(--mc-radius-md)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <h2
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
                color: 'var(--mc-text-muted)',
                margin: 0,
              }}
            >
              How collections behave
            </h2>
            <div aria-hidden style={{ height: 1, width: '100%', background: 'var(--mc-border-default)' }} />
            <p style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)', margin: 0 }}>
              A T-shirt can sit in more than one collection. Removing it from a collection does not
              unpublish it — it just stops appearing there. Hiding a collection takes it off the shop
              entirely, including its own page: anyone following a link you have already shared will
              get a not-found. Only a live collection is visible to customers.
            </p>
          </section>
        </div>
      </div>
    </WideOnly>
  );
}

/** "4 collections · 1 scheduled · drag to set the order..." (145:2506),
 * with the menu claim narrowed — see the note at the top of this file. */
function subtitle(total: number, scheduled: number): string {
  if (total === 0) return 'None yet';
  const parts = [`${total} collection${total === 1 ? '' : 's'}`];
  if (scheduled > 0) parts.push(`${scheduled} scheduled`);
  if (total > 1) parts.push('drag to set the order they appear on the collections page');
  return parts.join(' · ');
}

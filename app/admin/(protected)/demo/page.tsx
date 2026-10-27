import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { requireStaffPage } from '@/lib/admin/require-staff';
import { SeedDemoImages } from './demo-actions';

export const metadata = { title: 'Demo data — Metheues admin' };

/**
 * /admin/demo — the one screen that exists only because this shop is not
 * live yet, and the one screen that should be deleted first when it is.
 *
 * IT IS NOT IN THE DESIGN FILE and never will be. The owner asked, before
 * any supplier is in place, to see the app working end to end with a
 * populated catalogue. That is a reasonable thing to want and it needs data
 * that nobody has yet, so the data is generated and placeholder — and the
 * single largest risk with placeholder data is that everyone forgets it is
 * placeholder.
 *
 * SO THIS PAGE'S REAL JOB IS THE COUNT AT THE TOP. It reads the live
 * database rather than quoting anything, so it cannot go stale the way a
 * note in a file does, and it is linked from the dashboard so it is in
 * front of whoever opens the admin. The button is almost incidental.
 *
 * STAFF, NOT OWNER. Adding photographs to products that have none is
 * ordinary catalogue work and is reversible in A05. Nothing here prices a
 * basket or destroys a record, which is where A22's owner line sits.
 */
export default async function DemoDataPage() {
  await requireStaffPage();
  const supabase = await createServerComponentClient();

  const [products, images, collections] = await Promise.all([
    supabase.from('products').select('id, name, slug, status, made_in, composition'),
    supabase.from('product_images').select('id, product_id, alt_text'),
    supabase.from('collections').select('id, slug, name, hero_path'),
  ]);

  if (products.error) throw new Error(`Could not read products: ${products.error.message}`);
  if (images.error) throw new Error(`Could not read images: ${images.error.message}`);
  if (collections.error) throw new Error(`Could not read collections: ${collections.error.message}`);

  const rows = products.data ?? [];
  const imageRows = images.data ?? [];
  const collectionRows = collections.data ?? [];

  const photographed = new Set(imageRows.map((i) => i.product_id as string));
  const unphotographed = rows.filter((p) => !photographed.has(p.id as string));
  // Every product carries Portugal as its origin today, which is the demo
  // value — a real catalogue would not all agree by accident.
  const withPlaceholderSpec = rows.filter((p) => p.made_in === 'Portugal');
  // The first demo batch was flat-lay photography with nobody in it. The
  // owner has since asked for the garments to be shown on a model, so these
  // are counted rather than assumed gone — the fill guard leaves a
  // photographed product alone for good, which is right for a real
  // photograph and too blunt for a superseded demo one.
  const flatLays = imageRows.filter((i) =>
    typeof i.alt_text === 'string' && i.alt_text.includes('laid flat on a pale grey background'),
  );

  return (
    <div className="mc-admin-page">
      <div className="mc-admin-topbar">
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
            Demo data
          </h1>
          <p style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)', margin: 0 }}>
            What in this shop is a placeholder, counted from the database rather than remembered.
          </p>
        </div>
      </div>

      <div className="mc-admin-content" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Panel heading="This shop is not carrying real information yet">
          <p style={text}>
            Everything below was created so the app could be seen working from browsing to paying
            to packing to a refund, before any supplier is in place. It is all replaceable and
            none of it is a claim anyone has verified.
          </p>
          <ul style={list}>
            <li>
              <strong>{withPlaceholderSpec.length}</strong> of {rows.length} products carry the
              placeholder garment specification — the same fabric weight, composition and country
              of origin on every one. A real catalogue would not agree by accident.
            </li>
            <li>
              <strong>{imageRows.length}</strong> photographs are attached, and the demo ones were
              machine-generated. They show the right garment and no brand marks, but they are not
              photographs of stock anybody owns — and the people wearing them do not exist.
            </li>
            <li>
              <strong>{collectionRows.length}</strong> collections exist, both created as demo
              data.
            </li>
            <li>
              Stripe is in <strong>test mode</strong>, so nothing here can take a real payment.
              That is the thing actually keeping the placeholder claims harmless.
            </li>
          </ul>
          <p style={text}>
            <Link href="/admin/products">Edit the specification in A04</Link> as real information
            arrives. <code style={code}>docs/real-data-needed.md</code> lists every field, figure
            and document still waiting, and <code style={code}>docs/demo-data/</code> has the
            teardown.
          </p>
        </Panel>

        <Panel heading="Demo photographs">
          <p style={text}>
            Adds the bundled photographs to any product that has none, and a hero to any collection
            without one. It never touches a product that already has photography, so real pictures
            can never be pushed down the running order by it — and running it twice does nothing
            the second time.
          </p>
          {unphotographed.length === 0 ? (
            <p style={text}>
              Every product has at least one photograph, so there is nothing for this to do.
            </p>
          ) : (
            <p style={text}>
              {unphotographed.length} product{unphotographed.length === 1 ? '' : 's'} currently show
              the empty well: {unphotographed.map((p) => p.name).join(', ')}.
            </p>
          )}
          <SeedDemoImages />
        </Panel>

        <Panel heading="Flat-lays from the first demo batch">
          <p style={text}>
            The first batch photographed the garments laid flat, with nobody in them. The rest of
            the range is shown on a model, so these four sit oddly beside it. Replacing them
            removes those rows and their files and puts a model shot in their place.
          </p>
          <p style={text}>
            It finds them by their exact description, so a photograph anyone has uploaded or
            re-described is not one of them and cannot be caught by this.
          </p>
          {flatLays.length === 0 ? (
            <p style={text}>
              No flat-lays are left, so there is nothing for this to do.
            </p>
          ) : (
            <>
              <p style={text}>
                <strong>{flatLays.length}</strong> flat-lay photograph
                {flatLays.length === 1 ? '' : 's'} would be replaced.
              </p>
              <SeedDemoImages swapFlatLays />
            </>
          )}
        </Panel>

        <Panel heading="When this shop goes live">
          <p style={text}>
            Delete this page and <code style={code}>public/demo/</code>, run the teardown, and
            check the dashboard notice has gone. The notice is driven by the same counts above, so
            it disappears on its own once the placeholder data does — which is the point of
            counting rather than hardcoding.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'var(--mc-bg-surface)',
        border: '1px solid var(--mc-border-default)',
        borderRadius: 'var(--mc-radius-md)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <h2 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 16, fontWeight: 600, margin: 0 }}>
        {heading}
      </h2>
      {children}
    </section>
  );
}

const text: React.CSSProperties = { fontSize: 14, lineHeight: '21px', margin: 0 };
const list: React.CSSProperties = {
  margin: 0,
  paddingLeft: 20,
  fontSize: 14,
  lineHeight: '22px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};
const code: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12.5,
};

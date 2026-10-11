import { createServerComponentClient } from '@/lib/supabase/server-component';
import { requireStaffPage } from '@/lib/admin/require-staff';
import { WideOnly } from '@/components/admin/wide-only';
import { SettingsForm, Panel, Row } from './settings-form';

/**
 * A22 Store settings — Figma 146:3214 (Desktop pulled) / 146:2988
 * (Tablet). No Mobile frame, and `admin_breakpoint_decision` lists A22
 * among the sixteen no_mobile screens, so it sits behind WideOnly.
 *
 * THIS IS THE FIRST ADMIN SCREEN THAT CHANGES WHAT A CUSTOMER IS CHARGED,
 * and it is owner-only for that reason. Every other write in this admin is
 * gated on is_staff(), which is right for packing a parcel; these columns
 * price a basket. A22's own staff card draws the line in the same place —
 * "Staff — orders, fulfilment and returns, no settings" — so the route
 * refuses a staff session and this screen renders read-only for one.
 * is_owner() has existed since 002 and nothing had ever used it.
 *
 * MIGRATION 018 WENT IN WITH THIS SCREEN, because the Delivery card could
 * not otherwise be real. The free-delivery threshold was a column that
 * checkout read; the prices beside it were two integer literals in the
 * checkout route. So the owner could change WHEN delivery became free but
 * not what it cost, and £3.95 needed a developer. 018 adds the two
 * columns, defaulted to exactly the literals they replace, and the route
 * reads them in the same commit — a column nothing reads would only be a
 * third place for the price to disagree with itself.
 *
 * MAINTENANCE MODE IS NOW WIRED TOO. `maintenance_mode` has existed since
 * 001 and nothing had ever read it. Checkout refuses with a 503 when it is
 * on, which is exactly what the design's card promises: "keeps the site
 * readable but stops anything being bought."
 *
 * WHAT IS OMITTED, and this screen omits more than any other, because the
 * design describes a shop with a settings table this one does not have:
 *
 *  - STORE DETAILS entirely — trading name, registered address, company
 *    number, VAT number. No columns anywhere. They belong in the footer
 *    and on invoices where they are a legal requirement, which is also why
 *    they sit on the owner-blocked list behind legal review rather than
 *    being typed into a form today.
 *  - The Ireland and Rest of Europe delivery rows. `delivery_method` is an
 *    enum of exactly tracked_48 and next_day, and checkout ships to GB and
 *    IE only. A per-country rate table is a real feature, not two more
 *    columns.
 *  - The collection fee. The column is real and NOTHING applies it to a
 *    refund, so a number typed there would be recorded and ignored — the
 *    one shape of field this project keeps refusing to ship.
 *  - Condition rules. No column; the wording lives in the returns page and
 *    the E6 template. Moving it here is worth doing and is not two lines.
 *  - Both tax tick boxes. Prices here are VAT-inclusive throughout, which
 *    is what UK law requires and what every total already assumes, so a
 *    switch implying otherwise would be the most expensive wrong tick on
 *    the screen. Nothing collects duties because nothing ships beyond
 *    GB/IE.
 *  - The Stripe account id and payout schedule. Neither is stored, and
 *    reading them would mean a live Stripe API call on an admin page load.
 *  - "Invite someone". There is no invite flow, deliberately — becoming
 *    staff is an owner changing a role in the database (README).
 *
 * The staff list IS real, read from profiles. The sender address is real
 * and comes from the environment rather than from `from_email`, which is a
 * column nothing reads — Resend will only send from a verified domain, so
 * the address and the deployment have to agree.
 */
export default async function AdminSettingsPage() {
  const staffSession = await requireStaffPage();
  const supabase = await createServerComponentClient();

  const { data: settings, error } = await supabase
    .from('store_settings')
    .select(
      'free_delivery_threshold_pence, delivery_tracked_48_pence, delivery_next_day_pence, return_window_days, vat_rate_basis_points, contact_email, maintenance_mode, updated_at',
    )
    .maybeSingle();
  if (error) throw new Error(`Could not load the store settings: ${error.message}`);
  // Migration 008 exists because this row was once missing and a NULL
  // return window silently became an unlimited one. Saying so beats
  // rendering a form full of blanks.
  if (!settings) {
    throw new Error(
      'store_settings has no row. Migration 008 seeds it — a missing row means an unlimited returns window, so fix the database rather than this page.',
    );
  }

  const { data: people, error: peopleError } = await supabase
    .from('profiles')
    .select('full_name, email, role')
    .in('role', ['staff', 'owner'])
    .order('role');
  if (peopleError) throw new Error(`Could not load who can sign in: ${peopleError.message}`);

  const staff = (people ?? []).map((p) => ({
    name: (p.full_name as string) || (p.email as string),
    email: p.email as string,
    role: p.role as string,
  }));

  return (
    <WideOnly title="Store settings">
      <SettingsForm
        isOwner={staffSession.role === 'owner'}
        staff={staff}
        // Read on the server: EMAIL_FROM is not a NEXT_PUBLIC_ variable and
        // must not become one.
        senderAddress={process.env.EMAIL_FROM ?? null}
        initial={{
          free_delivery_threshold_pence: settings.free_delivery_threshold_pence as number,
          delivery_tracked_48_pence: settings.delivery_tracked_48_pence as number,
          delivery_next_day_pence: settings.delivery_next_day_pence as number,
          return_window_days: settings.return_window_days as number,
          vat_rate_basis_points: settings.vat_rate_basis_points as number,
          contact_email: (settings.contact_email as string) ?? '',
          maintenance_mode: Boolean(settings.maintenance_mode),
        }}
      >
        <Panel heading="Payments">
          <Row label="Processor" value="Stripe Checkout" />
          <Row label="Currency" value="GBP (£)" />
          <Row label="Ships to" value="United Kingdom and Republic of Ireland" />
          <p style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)', margin: 0 }}>
            Card details never touch this store — the customer pays on Stripe&rsquo;s own hosted
            page and this shop only ever sees the result. The account id and payout schedule the
            design shows are not stored here; they are in the Stripe dashboard.
          </p>
        </Panel>
      </SettingsForm>
    </WideOnly>
  );
}

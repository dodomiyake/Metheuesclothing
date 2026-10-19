import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { requireCustomerPage } from '@/lib/account/require-customer';
import { AccountShell } from '@/components/site/account-shell';
import { DetailsForm } from './details-form';

export const metadata = { title: 'Account details — Metheues Clothings' };

/**
 * 18 Account Details — Figma 107:3945 (Desktop). Capped at 720.
 *
 * FOUR THINGS THE FRAME DRAWS NARROW HERE, each to a column that exists:
 *
 *  - FIRST NAME and LAST NAME are one field. `profiles.full_name` is a
 *    single column, and splitting a name on a space to fill two boxes is
 *    wrong for a great many real names — and rejoining them to save would
 *    quietly rewrite what someone typed.
 *  - EMAIL is read-only. Changing it means changing auth.users.email,
 *    which is a Supabase Auth flow with its own verification mail; what
 *    exists today is sign-up and password reset. Shown with its real
 *    verified state rather than a field that cannot be saved.
 *  - PASSWORD has no "last changed" date, because nothing records one.
 *    The row says what is true and links to the reset flow that does work.
 *  - DELIVERY UPDATES BY SMS is omitted. No SMS consent column exists and
 *    nothing sends a text, so an unticked box would be exactly the consent
 *    record A20's card warns against creating.
 *
 * ORDER AND ACCOUNT EMAILS stays as the design has it: a LOCKED row with
 * an ALWAYS ON tag rather than a tickbox nobody can untick — the Checkbox
 * component's own rule, the same one that settled A14's send control.
 *
 * CLOSING YOUR ACCOUNT keeps the explanation and drops both buttons, for
 * the reason A20 records: deleting a profile cascades to addresses and
 * nulls orders.profile_id, which turns a sales history into guest orders.
 * Erasure that keeps the sales record is a migration nobody has written.
 */
export default async function AccountDetailsPage() {
  const customer = await requireCustomerPage('/account/details');
  const supabase = await createServerComponentClient();

  const [profileQuery, settingsQuery] = await Promise.all([
    supabase.from('profiles').select('full_name, phone, marketing_opt_in').eq('id', customer.id).maybeSingle(),
    supabase.from('store_settings').select('contact_email').single(),
  ]);
  if (profileQuery.error) throw new Error(`Could not load your details: ${profileQuery.error.message}`);
  if (settingsQuery.error) throw new Error(`Could not load store settings: ${settingsQuery.error.message}`);

  const memberSince = customer.memberSince
    ? new Date(customer.memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null;

  return (
    <AccountShell
      current="details"
      eyebrow="Your account"
      title="Account details"
      meta={`${customer.email}${memberSince ? ` · Member since ${memberSince}` : ''}`}
    >
      <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Your details</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)' }}>
            What we hold about you, and how we contact you. Changes take effect on your next order.
          </p>
        </div>

        <DetailsForm
          email={customer.email}
          emailVerified={customer.emailVerified}
          initial={{
            full_name: (profileQuery.data?.full_name as string | null) ?? '',
            phone: (profileQuery.data?.phone as string | null) ?? '',
            marketing_opt_in: Boolean(profileQuery.data?.marketing_opt_in),
          }}
        />

        <Panel title="Password">
          <p style={{ margin: 0, fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)' }}>
            We will email you whenever your password changes, so an unexpected message means someone
            else is trying. Nothing here records when you last changed it.
          </p>
          <p style={{ margin: '14px 0 0' }}>
            <Link href="/forgot-password" className="mc-button-secondary">
              Change password
            </Link>
          </p>
        </Panel>

        <Panel title="Closing your account">
          <p style={{ margin: 0, fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)' }}>
            Closing an account removes your saved addresses and contact preferences. Order records
            are kept for six years because tax law requires it, and you can ask for a copy of your
            data at any time. Both are handled by a person rather than a button here, so that your
            order history survives the closure instead of quietly becoming guest orders.
          </p>
          <p style={{ margin: '14px 0 0' }}>
            <a
              href={`mailto:${settingsQuery.data.contact_email}?subject=${encodeURIComponent('My account data')}`}
              className="mc-button-ghost"
              style={{ paddingLeft: 0 }}
            >
              Email us about your data
            </a>
          </p>
        </Panel>
      </div>
    </AccountShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'var(--mc-bg-surface)',
        border: '1px solid var(--mc-border-default)',
        borderRadius: 4,
        padding: 20,
      }}
    >
      <h2
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '1.4px',
          textTransform: 'uppercase',
          color: 'var(--mc-text-muted)',
          margin: '0 0 14px',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { ModalDialog } from '@/components/admin/modal-dialog';
import {
  fieldStyle,
  labelStyle,
  sectionLabelStyle,
  inputStyle,
  helperStyle,
  primaryButtonStyle,
  disabledButtonStyle,
  ghostButtonStyle,
  panelStyle,
  mutedSmallStyle,
  ruleStyle,
} from '@/components/admin/dialog-styles';

/**
 * A20's "Erase this profile" (144:2882), built at last.
 *
 * It follows `admin_dialog_pattern` exactly, like A15 and A16 and the two
 * confirmations §9.6 requires: a consequence list computed from real data,
 * a reason, a typed confirmation, and a last line stating the literal audit
 * entry this will write. The Button component's description is explicit
 * that there is no destructive style here — the consequence list and the
 * typed gate ARE the safety mechanism.
 *
 * THE CONSEQUENCE LIST IS THE WHOLE POINT on this screen more than any
 * other, because erasure is the one action in the admin that nobody can
 * undo. A refund can be re-charged. A cancellation leaves the order. An
 * archived product can be published again. This cannot be reversed by us,
 * by Supabase or by the customer writing back to ask — so every line says
 * what goes and, just as importantly, what stays.
 *
 * TWO LINES SAY WHAT SURVIVES, and they are not padding. Someone pressing
 * this button is answering a legal request with a one-month deadline, and
 * the two things they will be asked afterwards are "is the sale still in
 * the books" (yes, tax law requires it) and "is their name still anywhere"
 * (yes, in the append-only audit log, which /privacy discloses).
 *
 * IT DISABLES ITSELF RATHER THAN FAILING when an order still needs its
 * address. Migration 023 refuses that case, and a dialog that lets you type
 * an email address and press the button only to be told no is worse than
 * one that says so up front — the Button component's own rule is that a
 * disabled control carries text saying what would enable it.
 */
const ERASURE_REASONS = [
  'The customer asked us to erase their data',
  'Right to erasure request (UK GDPR Article 17)',
  'The customer asked us to close their account',
  'Data entered in error',
  'Other',
];

export function EraseCustomer({
  email,
  displayName,
  hasProfile,
  orderCount,
  addressCount,
  returnNoteCount,
  onNewsletter,
  blockingOrders,
}: {
  email: string;
  displayName: string;
  hasProfile: boolean;
  orderCount: number;
  addressCount: number;
  returnNoteCount: number;
  onNewsletter: boolean;
  /** Paid orders not yet delivered or cancelled. 023 refuses while any exist. */
  blockingOrders: string[];
}) {
  const router = useRouter();
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = blockingOrders.length > 0;
  const matches = confirm.trim().toLowerCase() === email.toLowerCase();
  const canSubmit = Boolean(reason) && matches && !blocked && !saving;

  function openDialog() {
    setReason('');
    setConfirm('');
    setError(null);
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/admin/customers/${encodeURIComponent(email)}/erase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm_email: confirm.trim(), reason }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not erase this customer. Please try again.');
      return;
    }
    setOpen(false);
    // The page is keyed on an address no row holds any more, so staying here
    // would be a 500 on an account that no longer exists under that name.
    router.push('/admin/customers');
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        style={{ ...ghostButtonStyle, width: '100%' }}
      >
        Erase this customer
      </button>

      <ModalDialog open={open} onClose={() => setOpen(false)} labelledBy={headingId}>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 id={headingId} style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
              Erase {displayName}?
            </h2>
            <p style={{ fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)', margin: 0 }}>
              This cannot be undone by anyone — not by us, not by our hosting, and not by the
              customer asking us to put it back. There is no copy to restore from.
            </p>
          </div>

          <div aria-hidden style={ruleStyle} />

          <div style={panelStyle}>
            <p style={sectionLabelStyle}>What goes</p>
            <div aria-hidden style={ruleStyle} />
            <Consequence tone="var(--mc-status-error)">
              Their email address is replaced everywhere we hold it with a random
              <code style={code}>erased-…@erased.invalid</code> address that can never receive
              mail.
            </Consequence>
            {hasProfile ? (
              <Consequence tone="var(--mc-status-error)">
                Their name and phone number are removed from their account, their marketing
                preference is turned off, and they can no longer sign in.
              </Consequence>
            ) : (
              <Consequence tone="var(--mc-text-muted)">
                They have no account, so there is no profile or sign-in to remove — they ordered
                as a guest.
              </Consequence>
            )}
            <Consequence tone="var(--mc-status-error)">
              {orderCount === 0
                ? 'They have no orders to anonymise.'
                : `The delivery address on ${orderCount} order${orderCount === 1 ? '' : 's'} is cleared down to the country, and any note they wrote us is deleted.`}
            </Consequence>
            {addressCount > 0 && (
              <Consequence tone="var(--mc-status-error)">
                {addressCount} saved address{addressCount === 1 ? '' : 'es'} in their address book
                {addressCount === 1 ? ' is' : ' are'} deleted outright.
              </Consequence>
            )}
            {returnNoteCount > 0 && (
              <Consequence tone="var(--mc-status-error)">
                The note they wrote on {returnNoteCount} return{returnNoteCount === 1 ? '' : 's'} is
                deleted.
              </Consequence>
            )}
            {onNewsletter && (
              <Consequence tone="var(--mc-status-error)">
                They come off the mailing list completely, rather than being marked unsubscribed.
              </Consequence>
            )}
          </div>

          <div style={panelStyle}>
            <p style={sectionLabelStyle}>What stays, and why</p>
            <div aria-hidden style={ruleStyle} />
            <Consequence tone="var(--mc-status-success)">
              The sales themselves — totals, what was bought, payments and refunds — stay in the
              books for six years, because tax law requires us to keep them. The delivery country
              stays with them, because it decides the VAT treatment. They become an anonymous
              customer, not a deleted one.
            </Consequence>
            <Consequence tone="var(--mc-text-muted)">
              Entries already in the audit log keep their name. It is append-only on purpose, so
              nobody — including us — can edit or remove an entry. Our privacy policy says this in
              terms.
            </Consequence>
            <Consequence tone="var(--mc-text-muted)">
              Stripe keeps its own record of the payment as a controller in its own right. Erasing
              there is a separate request to Stripe.
            </Consequence>
          </div>

          {blocked && (
            <div style={{ ...panelStyle, borderColor: 'var(--mc-status-error)' }}>
              <p style={sectionLabelStyle}>Not yet</p>
              <Consequence tone="var(--mc-status-error)">
                {blockingOrders.join(', ')} {blockingOrders.length === 1 ? 'is' : 'are'} paid for and
                not yet delivered or cancelled, so we still need the delivery address to send it.
                Mark it delivered or cancel it, then come back.
              </Consequence>
            </div>
          )}

          <label style={fieldStyle}>
            <span style={sectionLabelStyle}>Reason (required)</span>
            <select
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ ...inputStyle, borderColor: 'var(--mc-border-strong)' }}
            >
              <option value="">Choose a reason…</option>
              {ERASURE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span style={helperStyle}>
              Written into the audit log, which is the only record that this was asked for rather
              than done by accident.
            </span>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Type their email address to confirm</span>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              style={inputStyle}
            />
            <span style={helperStyle}>
              Type {email} exactly. It is the last time this address will be readable here.
            </span>
          </label>

          {error && (
            <p
              role="alert"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--mc-status-error)',
                margin: 0,
                lineHeight: '21px',
              }}
            >
              {error}
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{ ...primaryButtonStyle, ...(canSubmit ? {} : disabledButtonStyle) }}
            >
              {saving ? 'Erasing…' : 'Erase this customer'}
            </button>
            <button type="button" onClick={() => setOpen(false)} style={ghostButtonStyle}>
              Keep their details
            </button>
          </div>

          {/* The Button component requires a disabled control to say what
              would enable it. */}
          {!canSubmit && !saving && (
            <p style={{ ...mutedSmallStyle, fontSize: 12, lineHeight: '18px' }}>
              {blocked
                ? 'Finish or cancel the order above first — erasing is refused while a parcel still needs an address.'
                : !reason
                  ? 'Choose a reason, then type their email address to confirm.'
                  : `Type ${email} in the box above to confirm.`}
            </p>
          )}

          <p style={{ ...mutedSmallStyle, fontSize: 12, lineHeight: '18px' }}>
            Recorded in the audit log as: you · customer erased · {orderCount} order
            {orderCount === 1 ? '' : 's'} anonymised · the reason above · today. The entry names the
            replacement address, never theirs — an address written to an append-only log would be
            the one copy erasure could never reach.
          </p>
        </form>
      </ModalDialog>
    </>
  );
}

const code: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  margin: '0 2px',
  wordBreak: 'break-all',
};

/** A bullet whose colour supports the sentence rather than carrying it —
 * rule 8. Each line reads correctly with the dot removed. */
function Consequence({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span
        aria-hidden
        style={{
          width: 5,
          height: 5,
          marginTop: 7,
          borderRadius: '50%',
          background: tone,
          flexShrink: 0,
        }}
      />
      <p style={{ flex: '1 0 0', minWidth: 0, fontSize: 13, lineHeight: '20px', margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

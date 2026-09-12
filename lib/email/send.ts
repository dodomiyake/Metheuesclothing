import 'server-only';
import { getResendClient } from './client';
import type { createServiceClient } from '@/lib/supabase/server';

type Db = ReturnType<typeof createServiceClient>;

/**
 * Sends one transactional email and never throws.
 *
 * This runs inside the Stripe webhook handler, after stock has already moved.
 * A thrown error there deletes the webhook_events claim (see the comment on
 * that catch block) and asks Stripe to retry — which would decrement stock
 * again were it not idempotent, and would look like a payment failure to any
 * monitoring keyed on webhook 500s. An unsent confirmation email is not that:
 * it is §15's "Email delivery failures", logged so a human can resend it, not
 * a reason to reprocess an order that already succeeded.
 */
export async function sendTransactionalEmail(
  db: Db,
  params: {
    template: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    /** For the audit log only — which order or return this email was about. */
    entityType: string;
    entityId: string;
  },
): Promise<{ ok: boolean }> {
  const { template, to, subject, html, text, entityType, entityId } = params;

  try {
    const { error } = await getResendClient().emails.send({
      from: process.env.EMAIL_FROM ?? 'Metheues Clothings <orders@metheues.com>',
      to,
      subject,
      html,
      text,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    await db.from('audit_logs').insert({
      actor_label: 'System',
      action: 'email_delivery_failed',
      entity_type: entityType,
      entity_id: entityId,
      summary: `${template} to ${to} failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    return { ok: false };
  }
}

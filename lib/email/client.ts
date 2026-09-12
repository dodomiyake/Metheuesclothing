import 'server-only';
import { Resend } from 'resend';

/**
 * Lazily constructed so a missing RESEND_API_KEY only breaks the send path,
 * not every import of this module (order confirmation is sent from inside
 * the Stripe webhook — see the note in send.ts about why that must not throw).
 */
let client: Resend | null = null;

export function getResendClient(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    client = new Resend(key);
  }
  return client;
}

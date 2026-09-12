import 'server-only';
import Stripe from 'stripe';

/**
 * Lazily constructed. `new Stripe(...)` at module scope throws when
 * STRIPE_SECRET_KEY is unset, and Next imports every route module during
 * `next build`'s page-data collection — before any request, and before
 * .env.local necessarily has secrets in it (a CI build, for instance). That
 * turned into a hard build failure the first time this ran. Constructing on
 * first use means only an actual request needs the key.
 */
let client: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    client = new Stripe(key);
  }
  return client;
}

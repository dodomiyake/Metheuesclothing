# Legal page drafts

Three pages the site chrome has linked to since it was built and which have
404'd ever since: `/privacy`, `/terms`, `/accessibility` (screen 35).

They were recorded as "blocked on legal review". That was half right. The
REVIEW is blocked; the DRAFTING never was, and because nothing was drafted the
review could not start. These are the drafts.

## What these are and are not

They are **accurate descriptions of what this system actually does**, written
from the schema, the routes and the processors rather than from a template.
Every factual claim in them was checked against the code — the retention
periods, the processor list, the rights that are actually implemented, and the
gaps that are not.

They are **not reviewed**, and they must not ship as they stand. Two things
have to happen first:

1. **You fill in the identity block.** Every `[OWNER: ...]` marker is a fact
   only you hold — trading name, registered address, company number, VAT
   number, the ICO registration if there is one. These are deliberately NOT
   guessed. The same call A22 and 34 Contact already made about store details.
2. **A solicitor reads them.** Particularly the Terms: liability, governing
   law and the consumer-rights sections carry real exposure and are not
   something to take from a draft, however carefully written.

## Wiring them up afterwards

Once reviewed, each becomes a page on `components/site/content-page.tsx` —
the `content_page_shell` that `/delivery`, `/our-story` and `/contact`
already use. That is roughly half an hour's work per page and no new
components. The footer links already point at the right addresses, so they
start working the moment the pages exist.

Figures that exist in `store_settings` should be READ rather than typed into
the copy, exactly as `/delivery` does — the return window and the delivery
prices especially. A legal page whose numbers disagree with the basket is
worse than no legal page.

## Gaps these drafts surfaced

Writing them found two things the codebase did not have recorded:

- **The rate limiter stores IP addresses.** `rate_limits.key` is
  `"<scope>:<ip>"`, swept after one day (`006_rate_limits.sql:58`). That is
  personal data under UK GDPR and had never appeared in any note. The
  retention is genuinely short and genuinely enforced, which is the good
  version of this finding.
- **There is no unsubscribe.** `newsletter_subscribers.unsubscribed_at` is
  read by A20 and included in the A20 export, and **nothing writes it**. No
  route, no link, no token. Nothing sends marketing email today so it is
  latent rather than live — but it has to exist before the first newsletter
  goes out, and PECR makes that a requirement rather than a nicety.

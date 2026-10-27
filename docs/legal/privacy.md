# Privacy and Cookie Policy

> **DRAFT — not reviewed, not live.** Fill every `[OWNER: ...]` marker and have
> a solicitor read this before it ships. See `docs/legal/README.md`.

Last updated: [OWNER: date this is approved]

## Who we are

Metheues Clothings ("we", "us") sells T-shirts in the United Kingdom at
[OWNER: the live domain].

- **Data controller:** [OWNER: registered company name]
- **Registered address:** [OWNER: registered address]
- **Company number:** [OWNER: company number]
- **ICO registration:** [OWNER: registration number, or delete this line if
  not registered — most e-commerce controllers must register and pay the data
  protection fee]
- **Contact for anything in this policy:** the address shown on our
  [contact page](/contact).

## What we collect, and why

**When you buy something.** Your email address, the delivery address you give
Stripe at checkout, and what you ordered. We keep a snapshot of the delivery
address on the order itself, so that editing your saved addresses later never
changes the record of where a past parcel went.

**When you create an account.** Your email address, and optionally your name
and phone number. You choose whether to give the last two.

**When you save an address.** Recipient name, address lines, city, postcode,
country and optionally a phone number for the courier.

**Payment details.** We never see or store your full card number. Stripe
processes the payment. What comes back to us is the card brand and its last
four digits — enough to tell you which card a refund went to, and nothing that
could be used to charge it.

**When you ask to return something.** The items, your reason, and any note you
write us.

**When you join the mailing list.** Your email address and the time you
consented.

**Automatically, on certain requests.** Your IP address, to rate-limit
sign-ins, registrations, password resets, order lookups, return requests and
mailing-list sign-ups. This is how we stop someone guessing passwords or
harvesting order numbers. **These records are deleted after one day.**

## Legal bases

| What | Basis |
|---|---|
| Taking and fulfilling your order | Performance of a contract |
| Account, saved addresses, order history | Performance of a contract |
| Returns and refunds | Contract, and our legal obligations under consumer law |
| Rate limiting and fraud prevention | Legitimate interests — keeping the shop and your account secure |
| Keeping records of orders, refunds and stock movements | Legal obligation (tax and accounting) and legitimate interests |
| Marketing email | Consent, which you may withdraw at any time |

## Who we share it with

We do not sell your data. We use these processors, and only these:

| Processor | What it handles | Where |
|---|---|---|
| **Supabase** | Our database and image storage — accounts, orders, addresses, returns | London, UK (eu-west-2) |
| **Stripe** | Card payment and checkout. Stripe is a controller in its own right for payment data — see Stripe's own privacy policy | UK/EU/US |
| **Resend** | Sending order, dispatch, cancellation, return and refund emails | Ireland (eu-west-1) |
| **Vercel** | Hosting the website itself | Global edge network |

We will also disclose information where the law requires it.

## How long we keep things

- **Orders, refunds and the records behind them:** kept for at least six years
  after the end of the relevant financial year, which is what UK tax law
  requires of us.
- **Our internal audit log:** append-only. Entries recording refunds,
  cancellations, dispatches, stock changes and return requests cannot be
  edited or deleted by anyone, including us — that is the point of it. Entries
  name the member of staff or customer who caused the event and the order or
  return number involved; they do not contain email addresses.
- **Rate-limiting records (including IP addresses):** deleted after one day.
- **Your account:** until you ask us to close it.
- **Mailing list:** until you unsubscribe.

## Your rights

Under UK GDPR you may ask us to give you a copy of your data, correct it,
delete it, restrict or object to how we use it, or port it elsewhere. You can
also complain to the Information Commissioner's Office at ico.org.uk.

**Access.** We can give you a complete copy of everything we hold against your
email address — profile, saved addresses, orders and their items, returns and
refunds — as a single file. Ask at the address on our contact page and we will
send it within one month.

**Correction.** You can change your name, phone number and marketing
preference yourself under [Account details](/account/details). Changing the
email address on an account is not something the site can do yet; write to us.

**Deletion — read this part carefully.** We cannot delete the record of a
completed order, because tax law requires us to keep it. What we can do is
disconnect it from you, and that is what we do when you ask: your email
address is replaced everywhere we hold it with a random address that can never
receive mail, your name, phone number and marketing preference are removed,
your saved addresses are deleted, the delivery address on each past order is
cleared down to the country it went to, and you can no longer sign in. The
sale itself stands as an anonymous entry in the books. We may ask you to wait
until an order already paid for has arrived, because until then we need the
address to send it.

Two things survive this. Our append-only audit log cannot have entries edited
or removed by anyone, including us — those entries identify a person by name
and an order or return number, never by email address, and the database itself
refuses to delete an account the log refers to. That is why erasure here means
making you anonymous rather than deleting a row. And Stripe keeps its own
record of a payment as a controller in its own right; erasing that is a
separate request to them.

[OWNER: this paragraph used to carry a warning that the code did not do any of
this. Migration 023 and A20's erase dialog closed that gap on 27 October, so
the wording now describes one action a member of staff takes rather than a
promise about careful handwork. Two points for your reviewer. First, the
retained audit entries: we think naming a person in an append-only log is
defensible as a fraud and accounting record under Article 17(3), and the
policy discloses it, but that is a judgement worth confirming. Second, the
deferral while an order is in flight — we hold the address until the parcel
arrives, on the Article 17(1)(a)/6(1)(b) ground that we still need it to
perform the contract. Both are stated to the customer rather than buried.]

## Marketing

We only send marketing email if you have asked for it. You can turn it off
under [Account details](/account/details).

[OWNER: there is currently no unsubscribe link, because nothing sends
marketing email yet. One must exist before the first newsletter goes out —
PECR requires a working opt-out in every marketing message. See
`docs/legal/README.md`.]

Order confirmations, dispatch notices, cancellations and refund notices are
service messages about a purchase you made. They are not marketing and you
cannot opt out of them while an order is in progress.

## Cookies and what we store in your browser

We do not use advertising or analytics cookies, and there is no tracking
pixel on this site.

**Strictly necessary cookies.** When you sign in, we set a session cookie so
you stay signed in. Stripe sets its own cookies on the checkout page it
hosts, for fraud prevention.

**Browser storage, not cookies.** Your shopping bag lives in your own
browser's local storage — it never reaches our servers until you check out.
We also keep a short list of recently completed order numbers there, so that
revisiting an old confirmation page does not empty a bag you have refilled
since. Both are specific to the browser you are using, are not shared with
anyone, and clearing your site data removes them.

## Children

This shop is not intended for children, and we do not knowingly collect data
from anyone under 16.

## Changes

If we change this policy we will update the date at the top. If a change
materially affects how we use data you have already given us, we will tell
you directly.

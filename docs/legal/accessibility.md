# Accessibility Statement

> **DRAFT — not live.** This is the least legally fraught of the three: it is
> a factual description of the site rather than a contract, and it needs your
> sign-off more than a solicitor's. But **do not publish it while the known
> issues below are still true** — an accessibility statement that overstates
> conformance is worse than none. See `docs/legal/README.md`.

Last updated: [OWNER: date this is approved]

## Our commitment

We want this shop to work for everyone, including people using a screen
reader, navigating by keyboard, or viewing at a large text size. We aim to
meet **WCAG 2.2 level AA**.

## What we have done

These are design rules the site is built around rather than things we checked
afterwards:

- **Colour is never the only way we show you something.** Every status — sold
  out, low stock, a form error, an order's progress — carries a word, not just
  a colour. Someone who cannot distinguish the colours loses nothing.
- **Touch targets are at least 44 by 44 pixels.** Every button, link in a
  navigation list, quantity control and icon control.
- **Text contrast meets AA**, and our palette is defined so that the
  combinations that would fail cannot be chosen. Form controls carry a border
  that meets the 3:1 contrast WCAG asks of user-interface components, because
  a white box on a near-white page is otherwise invisible.
- **Headings and landmarks are properly structured**, so a screen reader user
  can skip to the part they want.
- **Everything works from a keyboard.** Where the design uses drag-and-drop to
  reorder things, we added real "move up" and "move down" buttons beside it —
  a drag-only control cannot be operated from a keyboard at all.
- **Dialogs behave.** The add-to-bag panel and the admin confirmation dialogs
  are built on the browser's own dialog element, so focus is trapped inside
  them, the page behind is inert, and Escape closes them.
- **Counts and states are announced, not just drawn.** The bag icon's item
  count is part of its accessible name ("Bag, 3 items"), so it is spoken
  rather than only seen.
- **The site is built mobile-first** and checked at 390, 768 and 1440 pixels
  wide. Type sizes step with the screen rather than being fixed, and nothing
  scrolls sideways at any width.

## Known issues

We would rather name these than let you find them.

1. **One product photograph has a placeholder description.** The alt text on
   our only product image is filler text and does not describe the picture. A
   screen reader user gets nothing useful from it. This is being fixed.
   [OWNER: delete this item once A05 carries the real description.]
2. **That photograph also does not show the product it is attached to.**
   [OWNER: delete once the right photograph is up.]
3. **We have not had an independent audit.** The points above are our own
   assessment against WCAG 2.2 AA, applied as the site was built. No external
   tester or assistive-technology user has reviewed it.
4. **There is no size guide yet.** The link in our footer points elsewhere
   until we publish verified garment measurements. Sizing information is
   therefore incomplete for everyone, not only for disabled users.
5. **Some staff-only admin screens are not built for narrow screens** and show
   a short message below 768 pixels instead of the form. This affects our own
   staff, not customers.

## If something does not work

Please tell us — it is the fastest way for us to fix it, and we will not treat
it as a complaint. Write to us at the address on our
[contact page](/contact), including the page you were on and what happened.
We aim to reply within [OWNER: your reply window — the contact page currently
promises one, keep these the same].

If you need something from this site in a different format, ask and we will
find a way to get it to you.

## Enforcement

If you are not happy with how we respond, you can contact the Equality
Advisory and Support Service (EASS) at equalityadvisoryservice.com.

[OWNER: the Public Sector Bodies Accessibility Regulations 2018 do not apply
to a private shop, so there is no statutory statement format you must follow
and no legal deadline attached to this page. Your duty is the Equality Act
2010 one — to make reasonable adjustments. This statement is good practice
and evidence of that effort, which is why it is worth publishing once the
known issues above are honest.]

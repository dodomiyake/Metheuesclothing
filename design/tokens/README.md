# Metheues Clothings — design tokens

Generated from the Figma file `9SzUlTWGVKOCkAULkbqOsr` on 12 September 2026;
recoloured cool on 17 September 2026 and pushed back into that file, so the
two currently agree — including the Announcement Bar's accent ground and the
admin rail's on-dark accent.

- `tokens.css` — CSS custom properties. Drop into your global stylesheet.
- `tokens.ts` — the same values as typed exports.

There is no sync between these files and Figma. If a value changes in one,
change it in the other.

## The two layers

**Primitives** are the raw palette — `--mc-ink`, `--mc-mist`. Never reference
these in a component.

**Semantic tokens** say what a colour is *for* — `--mc-text-muted`,
`--mc-status-attention`. Components use only these. That indirection is the
reason a palette change lands everywhere at once instead of being a
find-and-replace across the codebase.

## Four rules that are easy to break

**1. Two colours fail on dark, and both have a twin.** Slate `#5A646E` on
Metheues Ink is 2.6:1; the accent `#2B3FD9` is worse at 2.4:1. On any dark
ground use `--mc-text-muted-inverse` (`#97A2AD`, 7.18:1) and
`--mc-accent-on-dark` (`#7C8CFF`, 6.26:1). This is why the footer, the admin
rail and the email header use different values from the rest of the site — it
is not an inconsistency. The accent half of this rule was learned the hard
way: the first pass of the cool recolour left the email header's "CLOTHINGS"
on the pale-ground accent and it was effectively invisible on black.

**2. Ultramarine is a brand accent, not a UI colour.** It carries the
announcement bar's ground, the footer newsletter action, the ADMIN wordmark and
the current-item rule in the admin rail. It is never focus, never a warning,
never a selected state (MVP §6) — Filter Chip's selected state stays ink and
Limited Edition stays `--mc-status-attention`, or the accent stops meaning
"Metheues" and starts meaning "chosen". Focus is `--mc-focus-ring`; "needs
attention" is `--mc-status-attention` (Ember).

**3. Colour is never the only signal.** Every status dot is paired with a word,
every error with text, every current nav item with weight and a rule as well as
a fill. The screens read correctly in greyscale. Keep them that way.

**4. 44px minimum on every interactive target.** Including icon buttons, the
announcement bar dismiss, quantity steppers and table row actions.

## Layout

| Breakpoint | Width | Page gutter |
|---|---|---|
| Mobile | 390px | 20px |
| Tablet | 768px | 32px |
| Desktop | 1440px | 48px |

Admin screens are built at 768 and 1440 only, except Dashboard, Orders table,
Order details, Returns queue, Inventory, T-shirts and Sign in, which also have
390 layouts because those are jobs people genuinely do on a phone.

## Type

Bodoni Moda for editorial headings, Manrope for everything else — UI, data,
labels. The roles in `tokens.ts` are what the screens actually use, not an
abstract scale invented after the fact.

Uppercase labels carry letter-spacing (1.1–1.4px). Without it they read as
shouting rather than as structure.

## Where the components are

Sixteen components live on the `00 · Foundations` page of the Figma file, and
each one's description records what its variants mean and the trap to avoid.
Read the description before changing a component — several encode decisions
that are not obvious from looking at the artwork.

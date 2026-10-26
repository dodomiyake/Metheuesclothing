# Garment specification — what we have, and what §8.5 still needs

`tshirt-standard-specification.pdf` was supplied on 26 October 2026 in answer
to a request for the garment spec. It is kept here because it is genuinely
useful, and this note exists because **it is not sufficient to build screen 23
from**, and the reason is worth stating once rather than rediscovering.

## What the document actually is

Its own title and subtitle: *"T-Shirt Standard Specification & Size Guide —
Commercial Production & Print Placement Sheet"*. Section 1 is headed *"Regular
Fit Unisex / Men's"* and carries *"Standard engineering tolerances: +/- 2.5 cm
(1 inch)"*. Section 3 is *"based on a medium (M) sized blank canvas"*.

So it is an **industry reference for a generic regular-fit blank**, not a
measurement of the T-shirt this shop sells. That distinction is the whole
problem, because §8.5 opens with:

> The guide must be specific to the actual T-shirt blank or manufactured
> garment

and closes with:

> Example data must be replaced by verified production measurements before
> launch.

Publishing these numbers as our size guide would be publishing example data,
which is the one thing that sentence forbids. `CLAUDE.md` has carried the same
line for months ("the size tables in the design are placeholders and must not
ship"), and this would be the same failure arriving through a different door.

## §8.5 checked line by line

| §8.5 requires | In the PDF? |
|---|---|
| Chest width | **Yes** — "Garment Width (A)", 45–64 cm across XS–3XL |
| Body length | **Yes** — "Garment Length (B)", 68–80 cm |
| Shoulder width | **No** |
| Sleeve length | **No** |
| Centimetres and inches | **Yes** — both, throughout |
| Explanation that values are garment measurements | **Yes** — section 4 |
| How to measure an existing T-shirt | **Yes** — section 4, and it is good: width flat across the chest 1 inch below the armpit fold, length from the highest shoulder seam to the bottom hem |
| Regular / relaxed / oversized fit explanation | **No** — the sheet covers regular fit only |
| Model height and worn size | **No** |
| Advice like "choose your usual size", only when accurate | **No basis** — cannot be judged without our own numbers |

**Four of ten, plus the opening requirement unmet.** Two of the four missing
(shoulder width, sleeve length) are a tape measure away. Two (fit explanation,
model height and worn size) are facts about our garment and our photography.

## What it does NOT contain at all

The four null columns on `products` are untouched by this document:

- **`composition`** — no fibre content anywhere in it
- **`fabric_weight_gsm`** — no GSM anywhere in it
- **`made_in`** — no country of origin anywhere in it
- **`fit`** — see the contradiction below

These are the regulated ones. UK textile labelling requires accurate fibre
composition, and origin claims sit under consumer protection law. They have to
come from the supplier's own sheet or the garment's care label; a standard
production reference cannot supply them and neither can a search.

## One contradiction worth settling

The sheet specifies **Regular Fit**. The photograph on the live product shows
an **oversized, boxy** polo — dropped shoulder, wide body. Both cannot describe
the same garment.

`products.fit` is therefore left null rather than set from this document. It is
not a cosmetic field: the shop listing builds its Fit filter straight out of
that column, Our Story derives a sentence from it, and the 05G/H/I cross-sell
subline reads it. Setting it wrong propagates to four places at once.

## What would close this in one pass

With a tape measure and one garment per size (S, M, L, XL, XXL — the sizes
actually stocked):

1. **Chest width** — flat across, 1 inch below the armpit fold (the PDF's own
   method, which is the right one)
2. **Body length** — highest shoulder seam to bottom hem
3. **Shoulder width** — seam to seam across the back
4. **Sleeve length** — shoulder seam to cuff

Plus, once, from the care label or supplier sheet: **composition**, **GSM**,
**country of origin**, and **which fit** the garment actually is. And from the
shoot: **the model's height and the size they wore**.

That is everything §8.5 asks for. The PDF's measuring instructions and
tolerance note can be reused verbatim — they are generic and correct, and
quoting a ±1 inch tolerance is honest rather than evasive.

## If the standard table is adopted deliberately

There is a legitimate alternative: decide that these blanks **are** standard
regular-fit and adopt the table as our own specification. That makes it
specific to our garment by adoption rather than by measurement, which satisfies
§8.5's opening in substance.

It needs to be a recorded decision rather than a default, and it still does not
supply shoulder width, sleeve length, the fit explanation, the model's height,
or any of the four regulated columns. It also cannot be squared with the
oversized cut in the photograph without explaining that first.

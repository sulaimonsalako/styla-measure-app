# Fit-engine test findings — 50 body types × real charts

Run `node tools/fit-test-harness.mjs`. The harness defines **50 spanning body types**
(25 female, 25 male — petite → moderate → plus → big&tall → extremes) and runs every
one through the **real** sizing engine against the **real** brand charts, then reports
where it breaks. This is our regression harness — re-run it after any engine change.

## Loopholes found — and what was fixed

### 1. CRITICAL (engine, fixed): bodies beyond a chart's range got the WRONG END
A big & tall woman shopping a chart that only goes to XXL was recommended **2XS** —
the *smallest* size. Cause: when no size fits, every size's score clamped to 0, so
they tied and the *first* (smallest) won. Fix: rank failing sizes by the **unclamped**
score (closeness), so a too-big body now gets the largest size and a too-small body the
smallest. Verified: big&tall → XXL, petite → 2XS, normal → M.

### 2. CRITICAL (engine, fixed): height-only / no-overlap charts recommended the first size to everyone
Tip Top's suit-jacket chart lists only Short/Regular/Tall by height — the engine scored
zero body dimensions and confidently returned "Short" to all 25 men. Fix: when **0
comparable dimensions** exist, the engine now returns `insufficient_data: true` with an
honest message instead of a fake size. The widgets should surface this as "we can't size
this chart for you" rather than a number.

### 3. DATA (fixed / flagged): mislabelled charts corrupt sizing
- **Azazie suits** tagged `flat_measures: [chest, waist…]`, doubling a full 37.5" chest
  to 75" → every man fell off the chart. Fixed: cleared the erroneous flat tags.
- **Au Noir suits** has chest values ~19–29" on a *body* chart (half/mis-parsed from the
  screenshot) → nonsense sizing. Flagged `verified = false` for re-entry via admin.

### Still-open data/coverage gaps (not engine bugs)
- Extreme bodies (F-extreme-plus 62" bust, M-extreme-8xl 74" chest) fall off *every*
  brand's largest size — correct behaviour, but a coverage gap: no brand we index serves
  them. The engine now honestly says "tight fit, largest size" rather than guessing.
- Charts with only 1 comparable dimension (DXL waist-only, Kenneth Cole chest-only) score
  fine but low-confidence — coverage weighting already dampens these.

## Recommended next hardening
- A **chart sanity validator** in the admin save: warn when chest < waist, when doubling
  a flat chest exceeds ~60", or when a chart has zero body dimensions — catch #3 at entry.
- **Bra band+cup** engine logic (measurements now captured; sizing not yet modelled).
- Expand plus/big&tall coverage — the extremes have almost no brands that fit them.

## The 50 body types
Defined inline in `fit-test-harness.mjs` (`BODIES`) with a one-line note each, spanning:
petite/XXS, curvy, hourglass, pear, apple, athletic, moderate, plus 1X–3X, tall-plus,
big&tall, extreme-plus (F); slim, athletic V-taper, muscular, dad-bod, big&tall, very-tall-
lean, short-stocky, plus, extreme-8XL, broad/narrow shoulder, long-torso (M). Reusable as a
fixture to seed test accounts later.

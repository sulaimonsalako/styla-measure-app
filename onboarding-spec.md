# STYLA — Onboarding & Body-Model Input Spec

_Design reference for the questionnaire that builds a user's body model and powers
brand-fit matching. Source of truth for what we ask, why, and how._

## Principles

1. **Value-first.** No account required to start. Users complete the questionnaire and see
   a teaser result *before* we ask them to sign up (signup gates the SAVE and the full
   report, never the try).
2. **Predict from anchors, don't ask for everything.** Body dimensions are highly
   correlated. We collect ~6–8 anchor inputs per gender and predict the full 80+ measurement
   set via anthropometric models (reference datasets: ANSUR II, CAESAR, SizeUSA, NHANES).
3. **Plain language, not engineering.** "How tall are you?" not "Calibrate stature."
   Questions are about how clothes fit, never about judging a body.
4. **Minimize typing.** Taps and sliders carry the flow; pickers for known sizes; typed
   numbers are the rare exception (mobile-first audience).
5. **Skip is informed.** Users can skip anything they don't know. On skip we show:
   _"No problem — you can add this anytime in your dashboard. It makes your matches more
   accurate."_ The engine fills a predicted default and flags the field as "add later."
6. **Predict → adjust.** Results show a confidence level; users can nudge a value that feels
   off. More honest and more accurate than pretending a guess is exact.
7. **No body avatar.** The live feedback panel is the OUTCOME (matches filling in +
   precision meter), not a silhouette of the user's body.

## Entry flow (both genders)

1. Landing CTA "Find my perfect fit — free" → opens a focused full-screen flow (no login wall).
2. **Who's this for?** — `Just me` / `My wedding party` (tap cards). Routes everyday vs. bridal.
3. **Fit** — `Women's` / `Men's` (tap cards). Branches the questions below.

## Input control guide

| Control | Use for |
|---|---|
| Tap cards | Categorical: who's-this-for, gender, all fit questions (loose/right/snug), age ranges |
| Slider (live label + cm/in · kg/lb toggle) | Approximate continuous: height, weight, waist |
| Dropdown / wheel picker (with "Not sure" at top) | Known exact sizes: bra band + cup, collar/neck, shirt size, jacket size |
| Number field (numeric keypad), optional | Exact figures some know: inseam, hip inches |

## Shared questions (everyone)

| Question | Required | Control | Predicts |
|---|---|---|---|
| Height | Required | Slider | All length measurements |
| Weight | Required | Slider | All circumference measurements |
| Age (range) | Asked (optional) | Tap cards | Fat distribution, posture |

## Women's flow

| Question | Required | Control | How we ask it | Predicts |
|---|---|---|---|---|
| Bra size (band + cup) | **Required** | Two pickers | "Your usual bra size" | Bust/chest + underbust |
| Waist | Optional (derivable) | Slider | "Your natural waist, or the waist of jeans that fit" | Waist girth |
| Hips fit | **Required** | Tap cards | "When something fits your hips, the waist feels — loose / just right / snug" | Waist-to-hip ratio (shape) |
| Hip measurement | Optional | Number field | "Know your hip measurement?" | Sharpens hip girth |
| Inseam | Optional | Number field | "Or skip — we'll estimate from your height" | Trouser/dress length |

## Men's flow

| Question | Required | Control | How we ask it | Predicts |
|---|---|---|---|---|
| Waist | **Required** | Slider | "Your pant/jeans waist size" | Waist girth, seat |
| Shirt size | **Required** | Picker | "Your usual shirt size" | Chest girth |
| Chest fit | **Required** | Tap cards | "When a shirt fits your chest, the waist feels — loose / right / snug" | Chest-to-waist drop (build) |
| Neck / collar | **Required** | Picker | "Your collar size" | Neck (hard constraint for shirts) |
| Jacket size (e.g. 40R/42L) | Bonus (optional) | Picker | "Know your jacket size? (optional)" | Shoulders, torso length, sleeve |
| Inseam | Optional | Number field | "Or skip — we'll estimate from your height" | Trouser length |

**Note on shoulders (men):** shoulders are the one measurement that can't be altered
(jackets fit shoulders first — see `.agents/AGENTS.md`). Do NOT estimate shoulders from
height alone. Derive from build (chest-to-waist drop) + jacket size when available.

## Skip behavior

- Every skippable field has a clear **"Not sure — skip"** affordance (top of pickers,
  a skip link on sliders/number fields).
- On skip, show the inline note: _"You can add this in your dashboard anytime — it makes your
  matches more accurate."_
- Engine substitutes a predicted default and flags the field `needs_confirmation`.

## Results + precision

- Teaser result after the questions: top brand matches shown, the rest locked.
- **Precision meter** driven by how many required fields are filled:
  _"Your matches are 80% dialed in — add your neck size to sharpen shirt fit."_
- Signup moment (Google / magic link) to save the profile and unlock all matches.

## Dashboard completeness loop (retention)

- Profile shows a completeness indicator and prompts to fill skipped fields, each labeled
  with what it improves: _"+ Neck size → better dress-shirt matches."_
- Every skipped field becomes a reason to return.

## Minimum viable sets (quick reference)

- **Women:** height, weight, bra size, hips-fit. (+ age, waist, inseam as asked/optional)
- **Men:** height, weight, waist, shirt size, chest-fit, neck. (+ age, jacket, inseam as asked/optional)

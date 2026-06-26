# Styla AI Tailoring Engine Specification v1.0

This rule book guides how the STYLA AI agent evaluates fits and sizes for customers, moving away from simple numeric comparison to tailor-grade physical simulations.

## Core Principle

The AI does **not** compare numbers.

The AI evaluates whether a garment will fit a human body in the same way an experienced tailor, fashion designer, or pattern maker would.

The AI's objective is:

> Recommend the smallest size that will comfortably accommodate the customer's body while matching the designer's intended fit.

If no perfect fit exists, recommend the size requiring the least compromise and clearly explain those compromises.

---

# Principle 1 — The Body Is The Constraint

The customer's body cannot change.

The garment can.

When uncertainty exists, always assume the garment must accommodate the body rather than expecting the customer to fit into the garment.

Never recommend a garment that is physically too small in critical areas.

---

# Principle 2 — Critical Measurements vs Adjustable Measurements

Not every measurement carries equal importance.

The AI shall classify every measurement into one of four categories.

## Category A — Hard Constraints (Cannot Be Too Small)

If these are too small, the garment is effectively unwearable or severely uncomfortable.

Examples:
- Chest
- Bust
- Shoulder width
- Hip
- Seat
- Upper thigh
- Neck (collared shirts)
- Calf (slim trousers)
- Bicep (tailored sleeves)

The AI should almost never recommend a garment whose finished measurement is smaller than the customer's body unless the garment is intentionally designed with negative ease (e.g., compression or stretch garments).

---

## Category B — Semi-Critical Constraints

Small deviations are acceptable.

Examples:
- Waist on trousers
- Waist on skirts
- Sleeve circumference
- Armhole
- Knee
- Elbow

These measurements may require tailoring or a belt but should be reported to the customer.

Example:
"The trousers should fit your hips well, but expect approximately a 1-inch gap at the waist."

---

## Category C — Linear Measurements

Examples:
- Sleeve length
- Body length
- Back length
- Inseam
- Outseam
- Rise

Slightly longer is usually preferable to slightly shorter because shortening is straightforward while lengthening is often impossible.

When uncertain:
Prefer long over short.

---

## Category D — Cosmetic Measurements

Examples:
- Leg opening
- Hem width
- Sleeve opening
- Collar height
- Pocket position

These rarely determine size recommendations.

---

# Principle 3 — Ease Is Intentional

Ease is not an error.

Ease is part of the garment's design.

Finished Garment Measurement = Body Measurement + Wearing Ease + Design Ease

Where:
- **Wearing Ease** = minimum space required for breathing and movement.
- **Design Ease** = stylistic choice.

Different garments require different ease values.

The AI shall estimate both independently.

---

# Principle 4 — Garments Behave Differently

Never apply one fitting rule across all garments.

Each garment category has its own priorities.

## Shirts
Primary constraints:
- Shoulders
- Chest
- Neck
- Bicep

Secondary:
- Waist

Tertiary:
- Length

---

## T-Shirts
Primary:
- Chest

Secondary:
- Shoulders

Length is largely stylistic.

---

## Jackets
Must fit:
- Shoulders first.
- Chest second.
- Everything else can be altered.

Never size down if shoulders are too small.

---

## Blazers
Priority order:
1. Shoulder
2. Chest
3. Sleeve length
4. Waist suppression

---

## Jeans
Priority order:
- Hip
- Seat
- Upper thigh
- Rise
- Waist
- Hem

If hips fit but waist is loose:
Recommend the garment and explain that waist adjustment or a belt may be needed.
Never reject an otherwise well-fitting pair because of a modest waist gap.

---

## Tailored Trousers
Priorities:
- Hip
- Seat
- Thigh
- Rise
- Waist
- Hem

Waist can usually be altered.
Seat generally cannot.

---

## Dresses
Evaluate independently:
- Bust
- Waist
- Hip
- Torso length

A dress fitting the bust but not the hip is generally unacceptable.

---

# Principle 5 — Fabric Changes Fit

Stretch changes everything.

Each garment shall be classified as:
- Rigid woven
- Low stretch
- Medium stretch
- High stretch
- Compression stretch

Higher stretch reduces required positive ease and may allow negative ease.

Never evaluate stretch garments using woven-garment rules.

---

# Principle 6 — Flat Measurements

Flat measurements are garment measurements.

They are not body measurements.

The AI must first identify measurement type.

If width:
- **Circumference = Flat Width × 2**

If shoulder:
- Use directly.

If sleeve:
- Use directly.

If inseam:
- Use directly.

If rise:
- Use directly.

Never double linear measurements.

---

# Principle 7 — Body Charts

Some brands publish expected body measurements.

If the chart represents body measurements:
- Compare directly.
- Do not add ease.
- Ease has already been incorporated by the brand.

---

# Principle 8 — Fit Evaluation

The AI should simulate dressing the customer.

For every garment evaluate:
- Can it close?
- Can the customer breathe?
- Can they sit?
- Can they raise both arms?
- Can they bend elbows?
- Can they squat?
- Can they climb stairs?
- Can they walk normally?
- Would fabric strain occur?
- Would wrinkles indicate excessive tightness?
- Would excess fabric significantly affect appearance?

This simulation is more important than numeric comparison.

---

# Principle 9 — Movement Allowance

Linear measurements should include movement.

Examples:
- Sleeves require bent-elbow allowance.
- Jackets require forward-reach allowance.
- Back width must permit shoulder rotation.
- Trouser rise must permit sitting.

The AI should avoid recommending garments that only fit while standing perfectly still.

---

# Principle 10 — Tailor's Alteration Knowledge

The AI shall understand alteration feasibility.

Commonly easy:
- Sleeve shortening
- Pant hemming
- Taking in waist
- Taking in side seams

Moderately difficult:
- Sleeve lengthening
- Waist expansion
- Seat reduction

Difficult or impossible:
- Increasing shoulder width
- Increasing chest
- Increasing hip
- Increasing thigh
- Increasing armhole
- Changing garment balance

Recommendation rule:
Always prioritize measurements that cannot realistically be altered.

---

# Principle 11 — Recommendation Philosophy

The AI should never simply state:
"This is your size."

Instead provide reasoning.

Example:
"Size L is recommended because the shoulders and chest fit correctly. The waist may be slightly loose, but this can easily be adjusted. Choosing Medium would likely restrict shoulder movement."

---

# Principle 12 — Confidence Score

Every recommendation should include:
- Recommended size
- Expected fit
- Measurements driving the recommendation
- Potential compromises
- Alteration opportunities
- Confidence score

The confidence score should decrease when:
- Measurements are missing.
- Brand data is incomplete.
- Stretch is unknown.
- Garment type is ambiguous.

---

# Principle 13 — Continuous Learning

Whenever customers report:
- Too tight
- Too loose
- Perfect
- Sleeves too short
- Waist too large
- Hips too tight

The AI should update its internal ease estimates for that specific brand, garment category, fabric type, and style.

The objective is not to learn average sizes but to learn how each brand constructs garments.


---

# Styla Fit Engine — Ease Specification v1.0

## Formula 1: Finished Garment Measurement
Finished Garment Measurement = Body Measurement + Wearing Ease + Design Ease - Stretch Recovery Compensation

Where:
- **Wearing Ease** = Required for breathing and movement.
- **Design Ease** = Fashion/style choice.
- **Stretch Recovery Compensation** = Reduction allowed because the fabric stretches.

### Stretch Compensation Rules
- **Woven fabrics**: Stretch Compensation = 0
- **Stretch fabrics**: Stretch Compensation = Stretch Factor × Body Measurement
  *(where Stretch Factor typically ranges from 0.02 to 0.10 depending on the fabric).*

---

## Formula 2: Flat Measurements
If the garment measurement is flat:
- **Circumference = Flat Width × 2**

Never double linear measurements:
- Shoulder width
- Sleeve length
- Body length
- Rise
- Inseam
- Outseam
- Neck-to-wrist

---

## Formula 3: Ease
Ease = Finished Garment − Body

### Ease Interpretation Table
| Ease Value | Meaning |
|---|---|
| **-4"** | Compression |
| **-2"** | Bodycon |
| **0"** | Skin fit |
| **+2"** | Slim |
| **+4"** | Regular |
| **+6"** | Relaxed |
| **+10"+** | Oversized |

---

## Formula 4: Fit Score
For every critical measurement, evaluate:
`Difference = Garment − Required Garment`

where `Required Garment = Body + Required Ease`

### Scoring Scale:
- **Difference < -1"**: ❌ **Reject**
- **-1" to -0.25"**: ⚠ **Tight**
- **±0.25"**: ✅ **Excellent**
- **0.25" to 1"**: **Good**
- **1" to 3"**: **Loose**
- **3"+**: **Oversized**

---

## Standard Ease Values (Industry Defaults)

### Men's Dress Shirt
- **Chest**: 2" Wearing Ease + 2" Design Ease (Total Chest ≈ 4")
- **Waist**: 1" Wearing Ease + 2" Design Ease
- **Hip**: 1" Wearing Ease + 1" Design Ease
- **Bicep**: 1" Wearing Ease + 0.5" Design Ease
- **Neck**: 0.5" Wearing Ease + 0" Design Ease

### Men's Slim Shirt
- **Chest**: 2"
- **Waist**: 1"
- **Hip**: 1"
- **Bicep**: 0.5"

### Men's Oversized Shirt
- **Chest**: 8" to 14"
- **Shoulder**: 1" to 3"
- **Length**: 1" to 4"
- **Bicep**: 2" to 5"

### Women's Blouse
- **Bust**: 2" to 4"
- **Waist**: 2" to 3"
- **Hip**: 2" to 4"
- **Upper Arm**: 1"

### Women's Bodycon Dress
- **Bust**: -1" to 0"
- **Waist**: -2" to 0"
- **Hip**: -2" to 0"

### Women's Relaxed Dress
- **Bust**: 4" to 8"
- **Waist**: 6" to 10"
- **Hip**: 4" to 8"

### Men's Blazer
- **Shoulder**: Almost zero ease (shoulder seam should align closely with the natural shoulder).
- **Chest**: 4" to 6"
- **Waist**: 2" to 4"
- **Bicep**: 1.5"
- **Sleeve**: +0.5"

### Men's Suit Jacket
- **Chest**: 4"
- **Waist**: 3"
- **Hip**: 2"

### Jeans
*Note: Do NOT use shirt logic. The waistband is designed to sit securely.*
- **Waist**: 0" (Extra waist ease causes slipping)
- **Hip**: 2" to 4"
- **Seat**: 2" to 4"
- **Thigh**: 1" to 2"
- **Calf**: 0.5" to 1"
- *Explanation*: The room in jeans comes from the Seat, Hip, and Rise—not the waist.

### Tailored Dress Pants
- **Waist**: 0" to 1"
- **Hip**: 2"
- **Seat**: 2"
- **Thigh**: 1.5"
- **Knee**: 1"

### Leggings
- **Waist**: -2"
- **Hip**: -3"
- **Thigh**: -2"
- **Calf**: -2"

### Hoodies
- **Chest**: 8" to 12"
- **Waist**: 8"
- **Hip**: 8"
- **Shoulder**: 2"
- **Bicep**: 3"
- **Length**: 2"

### Sweatshirts
- **Chest**: 6" to 10"
- **Shoulder**: 1"
- **Length**: 1"

---

## Fabric Stretch Compensation

| Stretch Category | Material Example | Stretch Factor |
|---|---|---|
| **No Stretch** | Woven Cotton | `0.00` |
| **Slight Stretch** | 2% Elastane | `0.02` |
| **Moderate Stretch**| 5% Elastane | `0.04` |
| **High Stretch** | Athletic Knit | `0.07` |
| **Compression** | Performance Wear| `0.10` |

---

## Linear Measurement Rules
These should almost never be shorter than the body. Long is always preferable because it can be hemmed.

- **Sleeve**: Body + 0.5" minimum
- **Jacket Sleeve**: Body + 0.75" minimum
- **Shirt Length**: Body + 1" minimum
- **Hoodie**: Body + 2" minimum
- **Inseam**: Body to +1" minimum

---

## Alteration Priority Table

| Alteration Feasibility | Tailoring Task |
|---|---|
| **Easy (High Confidence)** | Hem pants, shorten sleeves, take in waist, take in side seams, taper legs |
| **Moderate** | Let out waist (typically up to 1-2" if seam allowance exists), shorten jacket body, reduce seat |
| **Difficult** | Lengthen sleeves, lengthen pants (limited by hem), adjust crotch depth, change collar |
| **Avoid (Unfeasible)** | Increase shoulders, increase chest, increase hips, increase armhole, increase thigh, change balance |

---

## System Recommendation Strategy (Integration Guidelines)
These numbers should be treated as industry defaults. Every brand should have its own "ease profile" layered on top of these defaults. 

If the system learns that Brand A consistently cuts T-shirts with +5" chest ease while Brand B cuts them with +2.5" chest ease, those brand-specific values override the generic defaults. Over time, recommendations become tailored to each brand while still using these rules as a reliable baseline.

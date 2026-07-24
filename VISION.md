# STYLA — Vision & Architecture

_The north star. What we're building now, how it extends to the future, and the data
decisions that keep near-term work from becoming throwaway. Companion to `onboarding-spec.md`._

## The one idea

Everything STYLA does is a **query over two indexes**:

- **Body index** — each user's fit profile (measurements + confidence + provenance).
- **Garment index** — each product's size-chart "fit envelope" (what body each size fits).

Plus one reusable function — **the fit engine**: _does this garment fit this body?_ →
returns best size, alteration needed, and a fit score.

Build those two indexes clean and make the fit engine a single service, and every feature
below is just a different way of calling it. **The data model is the moat; features are queries.**

## Product layers (maps every roadmap item)

**Consumer (B2C)**
- **Brand match** — rank brands whose sizes fit the user. _(NOW — $9.99 unlock)_
- **Item fit search** — find any product (dress, jeans, suit) that fits; deep-link to the
  brand to buy. _(FUTURE — affiliate revenue)_
- **Gifting / friend's size** — connected users can see each other's size (with permission)
  to shop gifts. _(FUTURE)_
- **Group fit (bridal)** — one style that fits an entire wedding party. _(NEXT)_

**Body-data inputs**
- **Questionnaire** — predicts measurements from ~6–8 anchors. _(NOW)_
- **3D scan** — higher-accuracy measurements. _(FUTURE — premium subscription)_

**B2B**
- **Brand analytics** — where demand/size gaps are; what to make more of; pattern optimization.
- **Embeddable widget** — "find my size / friend's size" on brand sites (the Shopify plugin).

## Monetization
- One-time **$9.99** unlock for the full brand-match list + size per brand (NOW).
- The **bookmarklet is FREE** with a free account — it drives adoption and body-data. Paid is
  the curated match list, not the tool.
- **Affiliate** on item fit search (FUTURE).
- **Premium subscription** for 3D scan accuracy (FUTURE).
- **B2B** analytics + widget subscriptions.

## Body index — schema & scan-merge

Never store a measurement as a bare number. Store each field with provenance:

```
measurement = { value, source, confidence, updated_at }
source ∈ { predicted, user_confirmed, scan }
```

- **Merge rule:** highest confidence wins per field.
- A **3D scan doesn't replace** the profile — it upgrades it field by field: measured values
  outrank predicted, fill gaps, raise confidence; untouched fields stay.
- Keep provenance so the UI can show "confirmed by scan" and the engine can weight accordingly.
- **Flywheel:** users with both questionnaire answers AND a later scan are training data to
  improve questionnaire predictions for everyone.

_Today `profiles` has flat measurement columns + `measurement_overrides` (jsonb) + `api_scans`
(jsonb). Evolve toward per-field provenance so the scan merge is trivial later._

## Garment index — storage & indexing

**Good news: the bones already exist in Supabase.**
- `brands` (id, name, domain)
- `size_charts` (brand_id, category, gender, `chart_data` jsonb, raw_source_url)
- `products_cache` (brand_id, **size_chart_id**, url, title)

The `products_cache → size_chart_id` link is the answer to "various products, various charts":
a chart is a first-class row; each product points to the one that governs it. Most products
inherit their brand+category chart; a bespoke product gets its own `size_charts` row.

**Extend to a real fit index:**
- `size_charts.chart_data` → normalize into a **fit envelope**:
  `{ size_label → { measurement → [min, max] } }` (the body range each size accommodates).
  The existing **AI Size Chart Maker** is the normalizer.
- `products_cache` → add `category`, `price`, `image`, `affiliate_url`, `available_sizes`.
- new `product_stock` (product_id, size_label, in_stock) — per-size, refreshed frequently.
- **Fit search:** precompute each product-size envelope; "items that fit me" = find products
  where the user's body ∈ `(envelope ± alteration tolerance)` for an in-stock size, ranked by
  fit score. Start with Postgres range queries + indexes; move to a search engine at scale.

**Freshness:** charts change rarely (version them); price/stock change constantly (refresh from
brand product feeds / Shopify API / affiliate networks often). Normalize charts on ingest.

## The fit engine

One function, reused everywhere (seed: `api/_helpers/sizing-engine.js`, spec: `.agents/AGENTS.md`):

```
fit(body, garmentSize) → { fits: bool, size, alterationNeeded, score }
```

- Brand match = best fit(body, ·) across a brand's sizes.
- Item search = fit(body, ·) filtered to in-stock products, ranked.
- Group fit = intersection of per-member fitting styles (below).

## Connections: gifting and bridal are the same primitive

Both are built on **one user-connection + permission model** — they differ only in query shape:

- **Gifting / friend's size** = a 1:1 connection. Query: `fit(friend_body, item) → their size`, so
  you can buy for them. Powers the "find a friend's size" option in the B2B widget too.
- **Group / bridal** = a named group of connections. Query: the **intersection** of each member's
  fitting styles (below).

Build the connection primitive once (foundation decision #4) and both are queries on top: one
person's size for gifting, the intersection across many for bridal.

## Group fit (bridal) — the algorithm

**Key unlock:** not one size for everyone — one **style** where each member has *her own*
fitting size (Sarah 8, Mia 12, Priya 6 — same dress, different sizes).

1. For each member, compute the set of styles that fit her (best size + alteration) — this is
   just the individual engine.
2. **Group answer = the intersection** of those sets: styles present for *every* member.
3. Rank survivors by group fit quality (least total alteration, or best worst-case fit).
4. Show the per-member size list. A style drops if any member has no fitting size; relax to
   "fits N-1 of N" to surface near-misses.

Because it reuses per-user matching, bridal is nearly free once the individual engine exists.

## Phasing

- **NOW:** questionnaire → body index → brand match → $9.99 unlock (dashboard) → bookmarklet.
- **NEXT:** group/bridal (intersection), user connections + gifting.
- **FUTURE:** item fit search + affiliate, premium 3D scan, B2B analytics + Shopify widget,
  continuous large-scale product/chart indexing.

## Four decisions to lock NOW (so the future is additive, not a rewrite)

1. Store fit profiles as a **structured measurement vector with per-field confidence & source**.
2. Store garment data as **normalized fit envelopes**, even for the first 3–5 brands.
3. Make **`fit(body, garment)` a single reusable service** — all features call it.
4. Add a **user-connections table with permission flags** now, even if unused (unlocks gifting,
   friend's-size, groups without a painful migration).

## Near-term build queue

1. **Rebuild the dashboard** — matches-first, $9.99 unlock, fit-profile secondary, remove
   "3D Body Scans," add "My Wedding Party" (placeholder), gate bookmarklet.
2. **Update the bookmarklet** (`decoder.js`) — read the new structured fit profile; foundation
   for friend's-size.
3. **Wire the questionnaire → engine → real matches** and the $9.99 Stripe unlock (reuse the
   export-payment pattern + a `has_paid_matches` flag).
4. **Resume the Shopify plugin** (`shopify-app/`) as the embeddable widget when we reach B2B.

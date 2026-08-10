# LIVERPOOL — cross-brand shoppable fit search

> Codename for the "ChatGPT for fashion" direction, parked 2026-08-09.
> Say **"recall Liverpool"** to pick this up. Nothing here is built yet beyond
> what's marked ✅.

## The idea

Turn the main Styla dashboard into a cross-brand product search where the
shopper asks in natural language and gets buyable results filtered by what
actually fits them.

Canonical test query:

> "Pink bridesmaid dress with stretch, under $200, in my size"

## Where that query stands today

| Part of the query | Status | Notes |
|---|---|---|
| bridesmaid dress | ✅ works | semantic embedding + `category` |
| in my size | ✅ works | `fitsMe` in `/api/catalog-search` runs the sizing engine per result |
| under $200 | ⚠️ trivial | `catalog_products.price` exists; search just doesn't filter on it |
| pink | ❌ missing | no colour facet — colour lives in unstructured text/variants |
| with stretch | ❌ missing | fabric/stretch only in free-text description |

Three of five effectively done. The gap is **structured attributes**.

## What already exists (don't rebuild)

- `catalog_products`: title, description, tags, collections, price, currency,
  image_url, variants (size + availability), category, url, brand_id,
  shop_domain, `embedding vector(768)`, `tsv`, `content_hash`, `shared`.
- Hybrid vector + full-text RPC `match_catalog_products` (filters `p.available`).
- `/api/catalog-search` with `fitsMe`, plus brand facets: `smallBusinessOnly`,
  `specialty`, `shipTo`.
- Authoritative + paginated Shopify sync with self-healing reconcile.

## The three real gaps

### 1. Structured attributes (highest leverage)
Add an extraction pass at ingest: one Gemini call per product emitting
`{colour_family, material, has_stretch, occasion, neckline, sleeve, formality}`
into indexed columns / JSONB. Cheap because the existing `content_hash` gate
means it only runs on changed products.

**Prerequisite — fix the option-axis bug first.** `mapShopifyProduct` maps
`variants.option1` to `size`, but many stores order options Colour-first. Extract
attributes before fixing that and you'll index colours as sizes. Read
`product.options[]` by NAME instead.

### 2. Catalogue beyond Shopify — use FEEDS, not per-platform APIs
Nearly every serious brand already publishes a **Google Merchant Center / Meta
catalog feed**: standardised XML/CSV with
`id, title, description, link, image_link, price, availability, size, color, material`.

- Maps almost 1:1 onto `catalog_products`.
- Hands you `color` and `material` ALREADY STRUCTURED — solves gap #1 for those brands free.
- One parser covers thousands of brands on every platform.
- Asking a brand for a feed URL they already generate is far lower friction than
  "install our app".
- **Affiliate networks** (Rakuten, CJ, AWIN, Impact, Skimlinks) give bulk product
  feeds *plus* commission on referred sales — how shopping engines normally
  bootstrap both catalogue and revenue.
- Avoid scraping: brittle and legally exposed when licensed feeds exist.

### 3. Size charts are the actual bottleneck
Feeds give products, not size charts. Without a chart a brand is searchable but
NOT fit-filterable — and fit is the whole point. See the sizing-engine audit in
CLAUDE.md: ~93% of stored chart rows carry only chest/waist/hips. The chart
pipeline, not the catalogue, gates this strategy.

## Other hard parts

- **Cold start.** Search across 20 brands feels broken; needs hundreds to feel
  credible. Another argument for feeds over app installs.
- **Freshness at scale.** Authoritative sync works for one shop. N brands with
  hourly price/stock churn is a different infrastructure problem.
- **Attribute-extraction cost** at millions of SKUs — mitigated by content_hash.

## Positioning

Don't ship this as "ChatGPT for fashion". Search is commoditised (Google, Amazon,
Lyst — all better funded). The differentiator is the one filter none of them can
compute: **"only show me what actually fits."** That's not a filter chip on top of
search, it's a different ranking function, and it should be the headline.

## Suggested sequence

1. Fix the variant option-axis mapping (read `options[]` by name).
2. Add price / price-range filtering to `/api/catalog-search`.
3. Attribute extraction at ingest → indexed colour, material, stretch, occasion.
4. One Google-Merchant-feed parser → non-Shopify brands.
5. Then chase brand supply.

Steps 1–3 are days of work against data already held.

## Related open item

Image handling for a visual index: currently only ONE image per product
(`image_url`). A fashion search wants the gallery plus the variant→image mapping
so a colour result shows that colour.

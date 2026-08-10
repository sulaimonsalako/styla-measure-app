# STYLA Measure — Project State & Working Notes

> Living handoff doc. Update the "Current State" section at the end of each work session.
> Maintained by Claude (Cowork). Took over from Antigravity IDE on 2026-07-23.

## What this is

STYLA Measure — AI body-measurement + sizing platform. Users take a phone-based 3D
body scan (powered by 3DLook), get 80+ tailor-grade dimensions, and use them to find
their correct size across brands. Two sides:

- **B2C (shopper):** `index.html` — scan, dashboard/digital-twin profile, bookmarklet
  that recommends sizes on any brand's site. Monetized via $4.99 PDF export (Stripe).
- **B2B (brands):** `brands.html` — pilot waitlist; on-site fit recommender, aggregated
  body-data analytics, AI sizing widget.

## Architecture

- **Frontend:** Static HTML/CSS/JS (NOT a framework). Main pages at repo root:
  `index.html`, `brands.html`, `bridesmaid.html`, `bookmarklet.html`, `admin-uploader.html`.
  Shared: `style.css`, `main.js`, `decoder.js` (large — bookmarklet/sizing logic).
- **Backend:** Vercel serverless functions in `api/`. Routes are consolidated behind
  dispatcher files + `vercel.json` rewrites (e.g. `/api/3dlook/*` → `api/3dlook-api.js`
  which fans out to `api/_3dlook/*`; `/api/store-*` → `api/store-api.js` → `api/_store/*`).
  This pattern exists to stay under Vercel's Hobby function count limit — keep using it.
- **Sizing engine:** `api/_helpers/sizing-engine.js`, governed by the spec in
  `.agents/AGENTS.md` — tailor-grade constraint logic (hard vs adjustable measurements,
  ease, per-garment rules). This is the core IP, not simple number comparison.
- **Data:** Supabase (`profiles`, `store_profiles` tables). Schema setup in
  `setup_styla_supabase.sql` + incremental `update_*.sql` files.
- **Payments:** Stripe (LIVE keys in `.env`), webhook-driven, with localStorage caching
  to survive webhook propagation race conditions.
- **Scan provider:** 3DLook (aka TDLook) API. Single-vendor dependency = the core tech.
- **Deploy:** Vercel. Blog/`journal/` is a separate Next.js app proxied via rewrite to
  `journal-five-sand.vercel.app`.
- **Extensions:** `chrome-extension/` (MV3) + Safari build via `fastlane/`. Bookmarklet
  is the no-install alternative.

## Env / secrets (in `.env` — do NOT commit, do NOT paste values in chat)

AIRTABLE_PAT, GOOGLE_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, STRIPE_SECRET_KEY,
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (LIVE), STRIPE_WEBHOOK_SECRET, THREEDLOOK_API_KEY,
TDLOOK_API_KEY.

## In progress (as of handoff)

- **Bridesmaid / group-order feature** — `bridesmaid.html` (untracked, newest file,
  last edited 2026-07-23). Title: "Perfect Bridesmaid & Suit Sizing Matching."
  Multi-slide onboarding wizard → digital twin → "Brand Fit Match Report" behind a paywall.
  New Supabase columns staged in `update_bridesmaid_schema.sql` (NOT yet confirmed run):
  `has_paid_bridesmaid_scan`, `has_paid_bridesmaid_report`, `shoulder` on `profiles`;
  paid flags on `store_profiles`. This is the coordinator/group-order direction.

## Watch-outs

- **134 uncommitted changes** on the working tree at handoff, incl. many `api/*` files
  and all main HTML pages. `bridesmaid.html` + several images are untracked. Nothing is
  committed for the bridesmaid feature yet — commit carefully / in logical chunks.
- Confirm `update_bridesmaid_schema.sql` has actually been run in Supabase before relying
  on those columns.
- Function-count consolidation pattern is deliberate — don't split routes back out.
- Live Stripe keys are in use.

## Connected systems (Cowork)

- **Git:** local commits work via bash. Delete perms enabled for the folder (the mount
  blocks `rm` by default — if a `.git/*.lock` reappears and blocks git, remove it; perms
  now allow it). No GitHub push credential in sandbox — Claude commits locally, user pushes.
- **Supabase (MCP):** project `tneflxtpmzodauygtslk` (Styla-measurement-Project, us-east-1).
  Can run SQL, list tables, apply migrations.
- **Vercel (MCP):** read/manage (projects, deployments, build logs). Does not deploy —
  deploys happen on git push. Project `prj_JlKXXBAWSG3MVTdVaLmZ6Ft6GvFL` / team `team_FVOcE...`.

## VERIFIED against live DB (2026-07-23)

- **Bridesmaid migration is NOT run.** `public.profiles` has NO `has_paid_bridesmaid_scan`,
  `has_paid_bridesmaid_report`, or `shoulder` columns; `store_profiles` lacks the paid flags.
  `update_bridesmaid_schema.sql` is still pending — the bridesmaid feature will break against
  prod until it's applied. (Apply via Supabase MCP when user approves.)
- **SECURITY: RLS disabled on 4 tables** — `store_products`, `store_categories`,
  `store_profiles`, `store_carts`. Anyone with the (client-side) anon key can read/write every
  row. `store_profiles` also stores `password` as plaintext. Remediation SQL exists but must
  NOT be auto-applied (enabling RLS w/o policies blocks all access). Needs policies designed.

## RLS remediation (in progress, 2026-07-23)

Full secure fix chosen. Code + SQL written; NOT yet applied to prod.

- **New:** `api/_helpers/supabase-admin.js` — central service-role client (bypasses RLS).
  All `api/_store/*` files now import it instead of building an anon-key client.
  Fixed a latent crash in `export-payment.js` (was importing `@supabase/supabase-client`).
- **`store-auth.js`:** bcrypt password hashing (`bcryptjs`), lazy migration (legacy
  plaintext rehashed on next successful login), + new actions `get-profile`, `guest-init`,
  `delete-profile`. Added `bcryptjs` + `raw-body` to `api/package.json`.
- **Frontend:** all 8 direct `store_profiles` calls in `index.html`, `bridesmaid.html`,
  `decoder.js` rerouted through `/api/store-auth`. No frontend file touches `store_*` now.
- **`update_rls_policies.sql`:** enables RLS on all 4 tables; public-read policy on
  `store_products`/`store_categories`; `store_profiles`/`store_carts` locked to service-role.

### PREREQUISITE before applying SQL / deploying
User must add `SUPABASE_SERVICE_ROLE_KEY` to **Vercel** env AND local `.env`. Without it,
backend falls back to anon key and all store writes break once RLS is on. `supabase-admin.js`
logs a warning when the key is missing.

### STATUS: APPLIED TO PROD (2026-07-23)
- Service-role key added to Vercel + .env by user. Code pushed + deployed (commit `6c476e6`,
  deployment READY on prod).
- `add_bridesmaid_columns` migration applied (bridesmaid schema now live).
- `enable_rls_store_tables` applied via Supabase SQL Editor (the apply_migration MCP call was
  blocked by a safety classifier for REVOKE/RLS DDL, so user ran the SQL directly).
- VERIFIED read-only: all 4 store_* tables have RLS enabled. store_profiles + store_carts =
  anon fully denied (no policy, no grants). store_products + store_categories = public-read
  SELECT policy; anon write grants remain but are inert (RLS denies writes w/o policy).
- Optional future hardening: `REVOKE INSERT,UPDATE,DELETE ON store_products, store_categories
  FROM anon, authenticated` (belt-and-suspenders; not required).
- CONFIRMED: user smoke-tested live app (store load, login, cart, guest scan) — all working
  under RLS. Service-role key is being picked up correctly. RLS remediation COMPLETE.

## Product index / catalog retrieval (NEW, 2026-08-03)

The AI could only ever see the ONE product on the current page. Built a real
retrieval layer so it can reason across a store's whole catalog (and it's the
same index that will power the discovery feed).

- **DB (APPLIED to prod, migration `catalog_products_pgvector_index`):** enabled
  `vector` (0.8.0) + `pg_trgm`. New table `public.catalog_products` (title, desc,
  tags, price, variants, image, url, category, brand_id, shop_domain, external_id,
  `embedding vector(768)`, `tsv`, `content_hash`). HNSW cosine index + GIN on tsv/tags.
  RLS enabled, service-role only (matches store_* tables). RPC
  `match_catalog_products(query_embedding, match_brand_id, match_shop,
  filter_category, query_text, match_count)` = hybrid vector + full-text. VERIFIED
  live: seeded 2 rows, correct product ranked 0.994, keyword filter worked, test rows deleted.
- **Embeddings:** `api/_helpers/embeddings.js` — Gemini `gemini-embedding-001` (768d; text-embedding-004 was retired)
  via existing GOOGLE_API_KEY (no new vendor/secret). `embedOne`/`embedMany` with
  RETRIEVAL_DOCUMENT vs RETRIEVAL_QUERY taskType; batches of 100.
- **Endpoints (behind store-api dispatcher — no new Vercel functions):**
  `POST /api/catalog-ingest` (`api/_catalog/ingest.js`) upserts a store's products
  keyed by (brand_id, external_id), content_hash gate skips re-embedding unchanged
  items. `POST /api/catalog-search` (`api/_catalog/search.js`) semantic search +
  optional `fitsMe` annotation (runs the sizing engine per result → recommendedSize/fits).
  Shared read lib `api/_catalog/retrieve.js`. Rewrites added to vercel.json.
- **Chat wired:** `api/extension-chat.js` now accepts `shop`/`domain`/`brandId`;
  when the shopper's message looks catalog-wide (keyword gate), it pulls top-6
  matches from the index and injects them as "OTHER PRODUCTS IN THIS STORE" so the
  AI recommends across the catalog. Best-effort, never blocks the chat.
- **Producer + freshness + assignment (DONE in code, 2026-08-03):**
  - `/api/catalog-ingest` now also accepts `{ remove: [externalId] }` to delete
    from the index (for product-delete webhooks). Either `products` or `remove`.
  - Shopify app (`shopify-app/web/index.js`): shared `mapShopifyProduct` +
    `pushToStylaIndex` helpers. `POST /api/merchant/sync-catalog` (button in the
    app) does the initial bulk pull. The existing products/create|update|delete
    **webhooks now also push single upserts/removals to the index**, so it stays
    live after the first sync (best-effort; failures logged, never 401 the webhook).
  - **Chart assignment UI:** default is auto (product type -> category -> chart, no
    work). Optional override: `GET /api/merchant/products` lists synced products;
    `POST /api/merchant/assign-chart` ({externalId|externalIds|productType, chartId})
    sets `catalog_products.size_chart_id` AND mirrors to `products_cache` (url->chart)
    which `widget-size` reads first. Frontend App.jsx has an "Assign charts to
    products" card grouped by product type, per-row dropdown + per-type bulk assign.
- **Widget + discovery wired (DONE in code, 2026-08-03):**
  - `styla-widget.js` chat payload now sends `domain`/`shop`/`category`, so the
    storefront AI Tailor gets cross-catalog retrieval (recommend other in-store
    products, not just the current one). VERIFIED 2026-08-09: the block sends
    `shop.permanent_domain` (the myshopify domain), which is exactly what ingest
    stores as `shop_domain` — so the feared custom-domain mismatch does NOT apply
    to the Shopify widget. It would only affect the universal embed, where the
    host passes its own domain.
  - `prototypes/styla-discovery.html` now calls `/api/catalog-search` (fitsMe with
    a demo profile) and renders real results incl. product images + click-through;
    falls back to the built-in mock when the index has no matches. Set `SHOP` var
    to scope to one store.
- **Sync is now AUTHORITATIVE + paginated (2026-08-08).** Sync only ever added, so
  products deleted/unpublished in Shopify kept being recommended (webhooks only catch
  deletes while the app is up). `fetchShopifyAllPages` follows the Link cursor; a full
  sync posts `authoritative:true` and ingest deletes that shop's rows not in the pull.
  Prune is fenced: explicit full sync only, all pages read, non-empty result, no batch
  truncation, non-empty keep-list, scoped to shop_domain. Webhook upserts never prune.
  Search RPC already filters `p.available`.
- **Self-healing (2026-08-08).** `runFullSync` is shared by the Sync button and
  `maybeAutoReconcile`, which fires background from `/api/merchant/products` when
  `shop_settings.settings.last_full_sync` is >24h old (timestamp written before the
  work + in-process Set = no stampede). Covers webhook misses. Residual gap: needs
  someone to open the app; a cron would close it but costs a Vercel function. All new JS is syntax-checked only — NOT run live (sandbox
  has no Supabase DNS / GOOGLE_API_KEY), so first real test is on deploy.

## Shopify app served frontend — IMPORTANT (2026-08-03)

The embedded app was still showing a STALE July-7 React mock ("STYLA Fit Engine /
Product Size Mapping"). Root cause: `web/shopify.web.toml` runs `dev = node index.js`
only (no Vite), so Express serves the app; `express.static(public)` was auto-serving
the prebuilt `public/index.html` (old React bundle in `public/assets/index-*.js`) at
`/`. The React source (`web/frontend/src/App.jsx`) was never rebuilt, and the real
no-build tool (`public/charts.html`) was shadowed by that index.html.

Decision: **`public/charts.html` is the served app** (no build step, robust). 
- index.js: `express.static(public, { index:false })` so `/` no longer auto-serves
  the stale bundle; `app.get('/', serveApp)` + catch-all serve charts.html.
- charts.html now has ALL merchant features: paste-to-parse size charts (save/list/
  delete), **Sync catalog to Styla AI** (POST /api/merchant/sync-catalog), and
  **Assign charts to products** (GET /api/merchant/products + POST
  /api/merchant/assign-chart, grouped by product type, per-row + per-type bulk).
  Uses App Bridge idToken (embedded) with ?shop fallback (dev) via mfetch.
- The React app in `web/frontend` (App.jsx has the same features) is now effectively
  dead code for serving — leave it or delete later; don't waste time rebuilding it.
- To see changes: restart `shopify app dev` (reloads index.js). charts.html is static,
  no build needed. The stale `public/index.html` + `public/assets/*` can be deleted.

## "Continue with Styla" one-tap auth (DONE in code, 2026-08-03)

Lets a storefront shopper sign into their Styla profile from the widget without
typing a password into the merchant's page, and stay signed in across the token
expiry. SSO-style, via a styla.ca popup (first-party Supabase session).

- **`connect.html`** (repo root, served at styla.ca/connect.html; `/connect` rewrite
  added): reads `origin`+`shop` query params (the requesting store), checks the
  Supabase session. Signed in -> "Continue as {email}" consent (shows requesting
  origin) -> posts `{type:'styla-auth', access_token, refresh_token, expires_at,
  email, profile}` via `window.opener.postMessage(payload, ORIGIN)` and closes.
  Signed out -> email/password login (Supabase) then same. Remembers approved
  origins in localStorage for silent re-auth. Uses the public SUPABASE_URL+anon key.
- **Widget (`styla-widget.js`):** module-scope `setSession/clearSession/ensureFreshToken`
  (refreshes via `${SB_URL}/auth/v1/token?grant_type=refresh_token` with the stored
  refresh token; clears on reject). `loadFit` now `await ensureFreshToken()`.
  Per-container: `openStylaConnect()` opens the popup; a `message` listener verifies
  `ev.origin===STYLA_ORIGIN` + `type==='styla-auth'`, stores the session, reloads fit.
  "Continue with Styla" button injected at top of the guest form (`ensureConnectBtn`)
  and as an "Already use Styla?" link in the save CTA. CSS in styla-widget.css.
- Security: token is a Supabase access token (widget-size/extension-chat already
  consume it via supabaseAdmin.auth.getUser). postMessage targets the exact store
  origin; receiver checks the sender origin. Refresh token IS stored in the store's
  localStorage (per-origin) — acceptable for MVP; an XSS on the merchant store could
  read it. CAVEAT: relies on window.opener (breaks if a store sets COOP
  same-origin — rare on Shopify). NOT run live; verify on deploy (needs connect.html
  deployed to styla.ca + the widget re-pushed).

## Surface parity + universal embed (DONE in code, 2026-08-03)

Answers to "is X built across all surfaces":
- **Shop-for-a-friend: fully built.** `api/_share/connections.js` (create/request/
  list/accept/revoke/get-profile/info + invite emails), `share.html` accept page,
  dashboard nav "Share & Gift" -> /share.html, notifications handle `respond-share`.
  Both the Shopify widget and widget.html surface the "Shopping for" dropdown.
- **Merchant on-page widget only exists for Shopify** (theme app extension). Other
  platforms now covered by the universal embed below (+ the bookmarklet for shoppers).

Two things shipped this pass:
- **widget.html parity** (the styla.ca-hosted widget used by the bookmarklet iframe
  AND the new embed): added the **other-sizes picker** (renders `widget-size`
  candidates -> tap a size to see its spectrum + per-dimension breakdown) and made
  the chat always call `/api/extension-chat` with `domain/shop/category` so it does
  **catalog cross-sell** in every mode (was `/api/chat` with no store context in
  brand-widget mode). Added a `styla-context` postMessage listener so the embed can
  hand it product title/desc for page-aware chat.
- **`embed.js`** (repo root, served at styla.ca/embed.js): universal snippet for
  WooCommerce/BigCommerce/Wix/custom. A `<div id="styla-fit" data-domain data-brand
  data-category data-gender data-product-*>` + the script mounts a "Find my size"
  button that opens `widget.html` in a modal iframe with product context via
  postMessage. `embed-demo.html` is a test product page (`<script src="/embed.js">`).
- NOT run live; verify on deploy. widget.html is served from styla.ca so shoppers are
  first-party there (no "Continue with Styla" popup needed inside that iframe).

## Keep the chart whole: dynamic columns + AI learns the table (2026-08-03)

Problem: charts.html reduced every uploaded chart to 4 fixed columns
(chest/waist/hips/inseam) via a hardcoded mapPom, dropping shoulder/sleeve/length/
neck/thigh/numeric-size etc. — even though the server `normalizeChart` already maps
ALL those POMs (KEY_MAP) and the engine supports them.

Fix (DONE in code):
- **charts.html: dynamic columns.** Table columns = whatever the parser returns
  (`poms`), plus a manual "+ Add measurement". Saves the full table AS-IS under the
  brand's own column names + `columns` + `sleeve_convention`/`shoulder_convention`
  into chart_data. normalizeChart (server) maps the known ones to canonical engine
  keys and keeps ranges; unknown columns ride along for the AI. No more 4-col cap.
- **AI learns the table.** `widget-size` now returns `chart:{columns,sizes}` (the raw
  full table) on BOTH the override and brand-category paths (also added candidates/
  breakdown to the brand-category path so the other-sizes picker works there too).
  `styla-widget.js` and `widget.html` pass `result.chart` as `sizeChart` to
  `/api/extension-chat`, so the AI can answer questions about ANY column (length in L,
  what the numeric size maps to, etc.).
- Also fixed: `shopify-app/web/index.js` now loads the repo-root `.env` (it had no
  local .env -> was hitting example.supabase.co/mock-key -> "fetch failed" +
  "merchant session not found"). Restart `shopify app dev`; if Sync still says session
  not found, reinstall the app so OAuth stores merchant_sessions against the real DB.
- NOT run live; verify on deploy + dev restart.

## Length options + multi-screenshot + chart notes (2026-08-03)

Three linked additions so a chart is captured WHOLE and its non-tabular context is usable:
- **Multi-screenshot -> one chart.** `parse-size-chart.js` now accepts
  `files:[{fileData,mimeType}]` (up to 6) as well as single `fileData`. Prompt tells
  Gemini to MERGE the images into one chart (de-dupe overlapping rows/cols) — for
  charts too wide/long for one screenshot. charts.html accumulates SHOTS (paste/drop/
  click add thumbnails, ✕ to remove) and a "Read chart (N images)" button posts them.
- **Length / proportion options (Petite/Regular/Tall).** Parser extracts
  `length_options:[{name,inseam,height_min,height_max,note}]` (cm->in) — garment LENGTH
  variants tied to height, kept OUT of sizeChart. charts.html has a length-options
  editor. `widget-size` adds `height` to the user, `pickLength(height,options)` returns
  `recommendedLength` (range match -> nearest), returned on both paths + in `chart`.
  Both widgets show "Suggested length: Regular" next to the size.
- **Chart notes/context.** Parser extracts `notes` (fit guidance: "runs small", model
  height, fabric/care). charts.html has a "Fit notes the AI can use" textarea.
  `widget-size` returns notes (top-level + in `chart`); `extension-chat` injects
  BRAND FIT NOTES + LENGTH OPTIONS into the system prompt so the AI answers from them.
- chart_data now carries: columns, sizes, sleeve/shoulder_convention, length_options, notes.
- NOT run live; verify on deploy.

## Sizing engine corrections (2026-08-09)

Audited `api/_helpers/sizing-engine.js` against real chart data. It scores 9 dims
(chest, waist, belly, hips, shoulder, sleeve, inseam, thigh, neck) but each is gated
on `if (chartX && userX)` — so the BRAND'S CHART is the ceiling, not the engine. Across
499 stored size rows: waist 466, hips 380, chest 349, length 57, sleeve 21, shoulder 18,
thigh/inseam/rise 6. ~93% of recommendations run on the standard three. More scan
measurements won't help until charts carry more columns.

Three defects fixed (commit `cb5b55e`):
- `critical` flag was accepted and never read → now weights deductions x1.75 for hard
  measurements (waist/inseam on bottoms). Verified it flips a real trade-off.
- `chartBelly` fell back to `chartWaist` → waist scored TWICE on tops (double penalty +
  fake 3rd dimension). Belly now needs a real belly/abdomen/stomach column.
- `length`/`rise`/`leg_opening` were discarded → now scored when the shopper has
  torso/rise, otherwise reported in the breakdown as informational.
- Also: coverage/confidence counted `Object.keys(breakdown).length`, which the phantom
  belly inflated. Now counts a per-candidate `scored` Set, so informational rows can't
  buy confidence. EXPECT SCORES TO DROP on thin charts (chest/waist top: 97 → 82) —
  that's honesty, not regression. `rank-brands` reads `dimensions_compared` and benefits.

Regression harness: `/tmp/run.mjs` + `/tmp/suite.mjs` pattern (before/after diff over
5 chart shapes + 6 assertions). Recreate if the engine is touched again.

## Parked ideas — recall by codename

- **"Liverpool"** → see `LIVERPOOL.md`. Cross-brand shoppable fit search
  ("ChatGPT for fashion"). When the user says *recall Liverpool*, read that file
  and continue from its "Suggested sequence". Parked 2026-08-09, nothing built yet.

## Current State — UPDATE THIS EACH SESSION

- 2026-07-23: Took over from Antigravity, wrote this doc, connected Supabase + Vercel,
  safety commit `8eaf1e9`. Built full RLS remediation (code + SQL, see above) — NOT applied
  to prod yet; waiting on user's service-role key. Syntax-checked all changed files.

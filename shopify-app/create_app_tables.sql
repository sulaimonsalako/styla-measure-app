-- Shopify embedded app's own tables. These were missing from the Styla Supabase
-- project, so the OAuth callback could not store the merchant's offline token and
-- catalog sync failed with "Merchant session not found". Applied to prod
-- (migration create_shopify_app_tables) on 2026-08-03.
--
-- Both hold merchant data and are accessed ONLY by the app backend via the
-- service-role key, so RLS is enabled with no policies (service role bypasses RLS;
-- the anon key is fully denied — important, merchant_sessions holds access tokens).

create table if not exists public.merchant_sessions (
  shop         text primary key,
  access_token text,
  scope        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table public.merchant_sessions enable row level security;

create table if not exists public.product_size_charts (
  shopify_product_id text primary key,
  title           text,
  handle          text,
  image_url       text,
  size_grid       jsonb default '{}'::jsonb,
  ease_profile_id text default 'regular',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.product_size_charts enable row level security;

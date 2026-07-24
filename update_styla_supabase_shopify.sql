-- SQL script to add tables needed for Shopify app catalog synchronization and proxy recommendations

-- 1. Create merchant_sessions table (for OAuth storage)
CREATE TABLE IF NOT EXISTS public.merchant_sessions (
    shop TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create product_size_charts table (mapping Shopify product IDs to size grids and metadata)
CREATE TABLE IF NOT EXISTS public.product_size_charts (
    shopify_product_id TEXT PRIMARY KEY,
    title TEXT,
    handle TEXT,
    image_url TEXT,
    size_grid JSONB DEFAULT '{}'::jsonb NOT NULL,
    ease_profile_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create shoppers table (linking shopify customers to 3D scans / digital twin measurements)
CREATE TABLE IF NOT EXISTS public.shoppers (
    shopify_customer_id TEXT PRIMARY KEY,
    twin_measurements JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disable Row Level Security (RLS) on these tables for serverless backend access
ALTER TABLE public.merchant_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_size_charts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoppers DISABLE ROW LEVEL SECURITY;

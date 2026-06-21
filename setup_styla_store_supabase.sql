-- SQL script to set up Styla Storefront tables in Supabase.
-- Run this in your Supabase SQL Editor.

-- 1. Create the store_products table
CREATE TABLE IF NOT EXISTS public.store_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    supplier TEXT,
    description TEXT,
    images TEXT[] DEFAULT '{}',
    single_price NUMERIC NOT NULL,
    bulk_price NUMERIC NOT NULL,
    sizes TEXT[] DEFAULT '{}',
    colors TEXT[] DEFAULT '{}',
    size_chart JSONB DEFAULT '{}'::jsonb,
    color_images JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create the store_categories table
CREATE TABLE IF NOT EXISTS public.store_categories (
    name TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Create the store_profiles table
CREATE TABLE IF NOT EXISTS public.store_profiles (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    twin TEXT,
    api_scans JSONB DEFAULT '[]'::jsonb,
    measurement_overrides JSONB DEFAULT '{}'::jsonb,
    manual_measurements JSONB DEFAULT '{}'::jsonb,
    verification_code TEXT,
    verification_code_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Create the store_carts table
CREATE TABLE IF NOT EXISTS public.store_carts (
    id TEXT PRIMARY KEY,
    creator_username TEXT,
    creator_email TEXT,
    friend_email TEXT,
    creator_items JSONB DEFAULT '[]'::jsonb,
    friend_items JSONB DEFAULT '[]'::jsonb,
    creator_paid BOOLEAN DEFAULT false,
    friend_paid BOOLEAN DEFAULT false,
    payment_status TEXT DEFAULT 'unpaid',
    amount_paid NUMERIC DEFAULT 0,
    creator_notified BOOLEAN DEFAULT false,
    friend_notified BOOLEAN DEFAULT false,
    batch_paid_email_sent BOOLEAN DEFAULT false,
    creator_measurements JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Disable Row Level Security (RLS) on storefront tables for serverless access
ALTER TABLE public.store_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_carts DISABLE ROW LEVEL SECURITY;


-- For existing databases, add the color_images column if it doesn't exist:
ALTER TABLE public.store_products ADD COLUMN IF NOT EXISTS color_images JSONB DEFAULT '{}'::jsonb;

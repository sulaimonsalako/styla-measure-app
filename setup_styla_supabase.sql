-- Run this in the Supabase SQL Editor

-- 1. Create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    chest NUMERIC,
    waist NUMERIC,
    belly NUMERIC,
    hips NUMERIC,
    height NUMERIC,
    inseam NUMERIC,
    api_scans JSONB DEFAULT '[]'::jsonb,
    measurement_overrides JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies

-- Drop existing policies to prevent "already exists" errors if re-running
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Users can delete their own profile
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile" 
    ON public.profiles FOR DELETE 
    USING (auth.uid() = id);

-- 4. Set up an automatic trigger to create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, chest, waist, belly, hips, height, inseam, api_scans, measurement_overrides)
  VALUES (
    new.id, 
    new.email,
    (new.raw_user_meta_data->>'chest')::numeric,
    (new.raw_user_meta_data->>'waist')::numeric,
    (new.raw_user_meta_data->>'belly')::numeric,
    (new.raw_user_meta_data->>'hips')::numeric,
    (new.raw_user_meta_data->>'height')::numeric,
    (new.raw_user_meta_data->>'inseam')::numeric,
    COALESCE((new.raw_user_meta_data->'api_scans'), '[]'::jsonb),
    COALESCE((new.raw_user_meta_data->'measurement_overrides'), '{}'::jsonb)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists (for safe re-running)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Create Sizing Cache Tables

-- Create Brands Table
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    domain TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Size Charts Table (Stores structured measurements for local engine)
CREATE TABLE IF NOT EXISTS public.size_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- e.g., 'Tops', 'Bottoms', 'Dresses'
    gender TEXT NOT NULL, -- 'Mens', 'Womens', 'Unisex'
    chart_data JSONB NOT NULL, -- Standardized array of sizes and their specs (inches)
    raw_source_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (brand_id, category, gender)
);

-- Create Products Cache Table
CREATE TABLE IF NOT EXISTS public.products_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT UNIQUE NOT NULL,
    brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
    size_chart_id UUID REFERENCES public.size_charts(id) ON DELETE SET NULL,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Enable Row Level Security for Caching Tables
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.size_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent errors
DROP POLICY IF EXISTS "Allow public select on brands" ON public.brands;
DROP POLICY IF EXISTS "Allow public select on size_charts" ON public.size_charts;
DROP POLICY IF EXISTS "Allow public select on products_cache" ON public.products_cache;

-- 7. Create Policies for Public Read access
CREATE POLICY "Allow public select on brands" ON public.brands FOR SELECT USING (true);
CREATE POLICY "Allow public select on size_charts" ON public.size_charts FOR SELECT USING (true);
CREATE POLICY "Allow public select on products_cache" ON public.products_cache FOR SELECT USING (true);

-- Allow public insert/update for caching operations
DROP POLICY IF EXISTS "Allow public insert on brands" ON public.brands;
DROP POLICY IF EXISTS "Allow public insert on size_charts" ON public.size_charts;
DROP POLICY IF EXISTS "Allow public insert on products_cache" ON public.products_cache;
DROP POLICY IF EXISTS "Allow public update on products_cache" ON public.products_cache;

CREATE POLICY "Allow public insert on brands" ON public.brands FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on size_charts" ON public.size_charts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on products_cache" ON public.products_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on products_cache" ON public.products_cache FOR UPDATE USING (true);

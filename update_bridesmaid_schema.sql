-- Run this in your Supabase SQL Editor to update your Supabase schema
-- for the Bridesmaid and Suit Brand Sizing Match features.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_paid_bridesmaid_scan BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_paid_bridesmaid_report BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shoulder NUMERIC;

ALTER TABLE public.store_profiles ADD COLUMN IF NOT EXISTS has_paid_bridesmaid_scan BOOLEAN DEFAULT false;
ALTER TABLE public.store_profiles ADD COLUMN IF NOT EXISTS has_paid_bridesmaid_report BOOLEAN DEFAULT false;

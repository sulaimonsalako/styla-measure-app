-- Run this in your Supabase SQL Editor to update your existing database for the premium PDF export feature.

-- 1. Add the has_paid_export column to the profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_paid_export BOOLEAN DEFAULT false;

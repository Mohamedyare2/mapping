-- ============================================================
-- Migration: Add `city` column to buildings table
-- Run this once in your Supabase SQL editor
-- ============================================================

-- Add city column (nullable so existing rows aren't broken)
ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS city TEXT DEFAULT NULL;

-- Optional index for filtering/grouping by city
CREATE INDEX IF NOT EXISTS idx_buildings_city ON buildings(city);

-- Backfill existing Berbera records
UPDATE buildings
SET city = 'berbera'
WHERE city IS NULL;

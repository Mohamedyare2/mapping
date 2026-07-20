-- ============================================================
-- Somaliland Smart House Numbering System — Database Schema
-- Requires: Supabase project with PostGIS extension enabled
-- ============================================================

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- Buildings table
-- ============================================================
CREATE TABLE IF NOT EXISTS buildings (
  id          BIGSERIAL PRIMARY KEY,
  number      INTEGER UNIQUE NOT NULL,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  -- Spatial index column (auto-generated from lat/lon)
  location    GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
                ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
              ) STORED,
  city        TEXT DEFAULT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes for performance (supports 100,000+ buildings)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_buildings_number   ON buildings(number);
CREATE INDEX IF NOT EXISTS idx_buildings_location ON buildings USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_buildings_lat_lon  ON buildings(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_buildings_city     ON buildings(city);

-- ============================================================
-- Auto-update updated_at on row change
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER buildings_updated_at
  BEFORE UPDATE ON buildings
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

-- Allow all access since we use anon key for everything in this setup
CREATE POLICY "All access policy"
  ON buildings FOR ALL
  USING (true);

-- ============================================================
-- Helper view: buildings with sequence metadata
-- ============================================================
CREATE OR REPLACE VIEW buildings_with_meta AS
  SELECT
    id,
    number,
    latitude,
    longitude,
    created_at,
    updated_at,
    ST_AsGeoJSON(location)::json AS geojson
  FROM buildings
  ORDER BY number;

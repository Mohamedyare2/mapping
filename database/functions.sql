-- ============================================================
-- PostGIS helper functions for Berbera Smart House Numbering
-- Run AFTER schema.sql in Supabase SQL Editor
-- ============================================================

-- Function: find nearest building to a GPS coordinate
-- Used by the backend /api/my-location endpoint
CREATE OR REPLACE FUNCTION nearest_building(user_lat DOUBLE PRECISION, user_lng DOUBLE PRECISION)
RETURNS TABLE (
  id         BIGINT,
  number     INTEGER,
  latitude   DOUBLE PRECISION,
  longitude  DOUBLE PRECISION,
  distance_m DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    b.id,
    b.number,
    b.latitude,
    b.longitude,
    ST_Distance(
      b.location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) AS distance_m
  FROM buildings b
  ORDER BY b.location <-> ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
  LIMIT 1;
$$;

-- Function: buildings within a radius (meters)
CREATE OR REPLACE FUNCTION buildings_within_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_m   DOUBLE PRECISION DEFAULT 500
)
RETURNS TABLE (
  id         BIGINT,
  number     INTEGER,
  latitude   DOUBLE PRECISION,
  longitude  DOUBLE PRECISION,
  distance_m DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    b.id,
    b.number,
    b.latitude,
    b.longitude,
    ST_Distance(
      b.location::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
    ) AS distance_m
  FROM buildings b
  WHERE ST_DWithin(
    b.location::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_m
  )
  ORDER BY distance_m;
$$;

-- Function: next available building number
CREATE OR REPLACE FUNCTION next_building_number()
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(MAX(number), 0) + 1 FROM buildings;
$$;

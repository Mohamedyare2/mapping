-- ============================================================
-- filter_polygon_rpc.sql
-- Creates a Postgres function that deletes all buildings whose
-- (longitude, latitude) falls OUTSIDE the Somaliland polygon.
-- Run this in the Supabase SQL Editor, then call it via RPC.
-- ============================================================

CREATE OR REPLACE FUNCTION delete_buildings_outside_somaliland()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    somaliland_poly geometry;
    deleted_count   integer;
BEGIN
    -- Build the Somaliland boundary polygon (lon, lat)
    somaliland_poly := ST_GeomFromText(
        'POLYGON((
            42.65 11.0,
            42.70 11.10,
            42.80 11.22,
            42.90 11.35,
            43.00 11.45,
            43.50 11.55,
            44.00 11.50,
            44.50 11.48,
            45.00 11.47,
            45.50 11.45,
            46.00 11.40,
            46.50 11.38,
            47.00 11.35,
            47.50 11.28,
            48.00 11.20,
            48.50 11.15,
            49.00 11.12,
            49.30 11.10,
            49.50 11.10,
            49.80 10.90,
            49.90 10.75,
            49.60 10.10,
            49.50  9.80,
            49.20  9.40,
            49.00  9.00,
            48.80  8.60,
            48.60  8.35,
            48.50  8.20,
            48.20  8.10,
            47.80  8.00,
            47.00  8.00,
            46.50  8.05,
            46.00  8.25,
            45.50  8.40,
            45.00  8.60,
            44.50  8.80,
            44.00  9.10,
            43.50  9.50,
            43.20  9.80,
            43.00 10.00,
            42.90 10.20,
            42.75 10.50,
            42.65 11.0
        ))',
        4326
    );

    -- Delete buildings outside the polygon
    WITH deleted AS (
        DELETE FROM buildings
        WHERE NOT ST_Within(
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
            somaliland_poly
        )
        RETURNING id
    )
    SELECT count(*) INTO deleted_count FROM deleted;

    RETURN jsonb_build_object(
        'deleted', deleted_count,
        'status', 'success'
    );
END;
$$;

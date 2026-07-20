/**
 * My Location route
 * POST /api/my-location   — find nearest building to user's GPS coords
 * Body: { latitude, longitude }
 */
const router = require('express').Router();
const supabase = require('../db/supabase');
const logger = require('../utils/logger');

router.post('/', async (req, res, next) => {
    try {
        const { latitude, longitude } = req.body;

        if (latitude == null || longitude == null) {
            return res.status(400).json({ error: 'latitude and longitude are required' });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ error: 'Invalid latitude or longitude' });
        }

        // Use PostGIS ST_Distance to find the nearest building
        // Using RPC function defined in Supabase SQL editor
        const { data, error } = await supabase.rpc('nearest_building', {
            user_lat: lat,
            user_lng: lng,
        });

        if (error) {
            // Fallback: manual distance calculation on top 1000 buildings
            logger.warn('nearest_building RPC not available, using JS fallback');
            return fallbackNearest(lat, lng, res, next);
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'No buildings found in database' });
        }

        const nearest = data[0];
        const distanceM = nearest.distance_m;

        res.json({
            building: {
                id: nearest.id,
                number: nearest.number,
                latitude: nearest.latitude,
                longitude: nearest.longitude,
            },
            distance: formatDistance(distanceM),
            walkingTime: formatDuration(distanceM / 1.4),   // avg 1.4 m/s walking
            drivingTime: formatDuration(distanceM / 11.1),  // avg 40 km/h city driving
            message: `You are near Building ${nearest.number}`,
        });
    } catch (err) {
        next(err);
    }
});

async function fallbackNearest(lat, lng, res, next) {
    try {
        const { data, error } = await supabase
            .from('buildings')
            .select('id, number, latitude, longitude')
            .gte('latitude', lat - 0.05)
            .lte('latitude', lat + 0.05)
            .gte('longitude', lng - 0.05)
            .lte('longitude', lng + 0.05)
            .limit(1000);

        if (error || !data?.length) {
            return res.status(404).json({ error: 'No buildings found nearby' });
        }

        let nearest = null;
        let minDist = Infinity;

        for (const b of data) {
            const d = haversine(lat, lng, b.latitude, b.longitude);
            if (d < minDist) {
                minDist = d;
                nearest = b;
            }
        }

        const distanceM = minDist;
        res.json({
            building: nearest,
            distance: formatDistance(distanceM),
            walkingTime: formatDuration(distanceM / 1.4),
            drivingTime: formatDuration(distanceM / 11.1),
            message: `You are near Building ${nearest.number}`,
        });
    } catch (err) {
        next(err);
    }
}

function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

module.exports = router;

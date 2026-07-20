/**
 * Navigation route
 * GET /api/navigation?fromLat=&fromLng=&toLat=&toLng=&mode=walking|driving
 * Proxies OSRM routing API and returns structured turn-by-turn directions
 */
const router = require('express').Router();
const logger = require('../utils/logger');

const OSRM_BASE = process.env.OSRM_URL || 'https://router.project-osrm.org';

router.get('/', async (req, res, next) => {
    try {
        const { fromLat, fromLng, toLat, toLng, mode = 'walking' } = req.query;

        if (!fromLat || !fromLng || !toLat || !toLng) {
            return res.status(400).json({
                error: 'Missing required params: fromLat, fromLng, toLat, toLng',
            });
        }

        const profile = mode === 'driving' ? 'car' : 'foot';
        const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
        const url = `${OSRM_BASE}/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=true&annotations=false`;

        const response = await fetch(url);
        if (!response.ok) {
            return res.status(502).json({ error: 'Routing service unavailable' });
        }

        const json = await response.json();
        if (json.code !== 'Ok' || !json.routes?.length) {
            return res.status(404).json({ error: 'No route found between these points' });
        }

        const route = json.routes[0];
        const leg = route.legs[0];

        // Build turn-by-turn steps
        const steps = leg.steps.map((step) => ({
            instruction: step.maneuver.type === 'arrive'
                ? `Arrive at Building`
                : buildInstruction(step),
            distance: formatDistance(step.distance),
            duration: formatDuration(step.duration),
            direction: step.maneuver.modifier || step.maneuver.type,
        }));

        res.json({
            distance: formatDistance(route.distance),
            duration: formatDuration(route.duration),
            drivingTime: mode === 'driving' ? formatDuration(route.duration) : formatDuration(route.duration / 4.5),
            walkingTime: mode === 'walking' ? formatDuration(route.duration) : formatDuration(route.duration * 4.5),
            mode,
            geometry: route.geometry,
            steps,
        });
    } catch (err) {
        logger.error('Navigation error: ' + err.message);
        next(err);
    }
});

function buildInstruction(step) {
    const { type, modifier } = step.maneuver;
    const road = step.name ? ` onto ${step.name}` : '';
    if (type === 'turn' && modifier) return `Turn ${modifier}${road}`;
    if (type === 'depart') return `Head ${step.maneuver.bearing_after > 270 || step.maneuver.bearing_after < 90 ? 'north' : 'south'}${road}`;
    if (type === 'continue') return `Continue straight${road}`;
    if (type === 'new name') return `Continue${road}`;
    if (type === 'roundabout') return `Enter roundabout and take exit ${step.maneuver.exit}${road}`;
    return `${type} ${modifier || ''}${road}`.trim();
}

function formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hrs}h ${rem}min`;
}

module.exports = router;

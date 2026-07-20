/**
 * Search route
 * GET /api/search?q=137   — find building by number
 */
const router = require('express').Router();
const supabase = require('../db/supabase');
const logger = require('../utils/logger');

router.get('/', async (req, res, next) => {
    try {
        const q = req.query.q?.trim();
        if (!q) return res.status(400).json({ error: 'Search query q is required' });

        const num = parseInt(q);
        if (isNaN(num) || num <= 0) {
            return res.status(400).json({ error: 'Search query must be a positive integer (building number)' });
        }

        const { data, error } = await supabase
            .from('buildings')
            .select('id, number, latitude, longitude, created_at, updated_at')
            .eq('number', num)
            .limit(1)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: `Building number ${num} not found` });
        }

        logger.info(`Search: found Building ${data.number}`);
        res.json(data);
    } catch (err) {
        next(err);
    }
});

module.exports = router;

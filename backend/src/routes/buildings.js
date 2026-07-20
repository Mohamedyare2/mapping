/**
 * Buildings routes
 * GET  /api/buildings         — paginated list (with bbox filter for map viewport)
 * GET  /api/buildings/:id     — single building
 * POST /api/buildings         — create (admin)
 * PUT  /api/buildings/:id     — update (admin)
 * DELETE /api/buildings/:id   — delete (admin)
 */
const router = require('express').Router();
const Joi = require('joi');
const supabase = require('../db/supabase');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// ─── Validation schemas ──────────────────────────────────────
const buildingSchema = Joi.object({
    number: Joi.number().integer().positive(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
});

// ─── GET /api/buildings ──────────────────────────────────────
// Query params: page, limit, minLat, maxLat, minLng, maxLng
router.get('/', async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(5000, parseInt(req.query.limit) || 500);
        const from = (page - 1) * limit;

        let query = supabase
            .from('buildings')
            .select('id, number, latitude, longitude, created_at, updated_at', { count: 'exact' })
            .order('number', { ascending: true })
            .range(from, from + limit - 1);

        // Viewport bounding box filter for efficient map loading
        const { minLat, maxLat, minLng, maxLng } = req.query;
        if (minLat && maxLat && minLng && maxLng) {
            query = query
                .gte('latitude', parseFloat(minLat))
                .lte('latitude', parseFloat(maxLat))
                .gte('longitude', parseFloat(minLng))
                .lte('longitude', parseFloat(maxLng));
        }

        const { data, error, count } = await query;
        if (error) throw error;

        res.json({
            buildings: data,
            total: count,
            page,
            limit,
            pages: Math.ceil(count / limit),
        });
    } catch (err) {
        logger.error('GET /buildings error: ' + err.message);
        next(err);
    }
});

// ─── GET /api/buildings/:id ──────────────────────────────────
router.get('/:id', async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from('buildings')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Building not found' });
        }
        res.json(data);
    } catch (err) {
        next(err);
    }
});

// ─── POST /api/buildings — admin only ────────────────────────
router.post('/', authenticate, async (req, res, next) => {
    try {
        const { error: valErr, value } = buildingSchema.validate(req.body);
        if (valErr) return res.status(400).json({ error: valErr.details[0].message });

        // Auto-assign next number if not provided
        if (!value.number) {
            const { data: maxRow } = await supabase
                .from('buildings')
                .select('number')
                .order('number', { ascending: false })
                .limit(1)
                .single();
            value.number = (maxRow?.number || 0) + 1;
        }

        const { data, error } = await supabase
            .from('buildings')
            .insert(value)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: `Building number ${value.number} already exists` });
            }
            throw error;
        }

        logger.info(`Building ${data.number} created at ${data.latitude},${data.longitude}`);
        res.status(201).json(data);
    } catch (err) {
        next(err);
    }
});

// ─── PUT /api/buildings/:id — admin only ─────────────────────
router.put('/:id', authenticate, async (req, res, next) => {
    try {
        const schema = Joi.object({
            number: Joi.number().integer().positive(),
            latitude: Joi.number().min(-90).max(90),
            longitude: Joi.number().min(-180).max(180),
        }).min(1);

        const { error: valErr, value } = schema.validate(req.body);
        if (valErr) return res.status(400).json({ error: valErr.details[0].message });

        const { data, error } = await supabase
            .from('buildings')
            .update(value)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Building not found' });
        }

        logger.info(`Building ${data.number} updated`);
        res.json(data);
    } catch (err) {
        next(err);
    }
});

// ─── DELETE /api/buildings/:id — admin only ──────────────────
router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from('buildings')
            .delete()
            .eq('id', req.params.id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Building not found' });
        }

        logger.info(`Building ${data.number} deleted`);
        res.json({ message: `Building ${data.number} deleted successfully` });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

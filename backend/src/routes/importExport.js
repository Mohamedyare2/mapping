/**
 * Import / Export routes
 * POST /api/import   — upload CSV, bulk insert buildings (admin)
 * GET  /api/export   — download all buildings as CSV (admin)
 */
const router = require('express').Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const supabase = require('../db/supabase');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    },
});

// ─── POST /api/import ── bulk insert from CSV ────────────────
router.post('/import', authenticate, upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

        const content = req.file.buffer.toString('utf-8');
        const rows = parse(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });

        if (!rows.length) return res.status(400).json({ error: 'CSV file is empty' });

        // Normalize and validate rows
        const buildings = rows.map((row, i) => {
            const lat = parseFloat(row.latitude || row.lat);
            const lng = parseFloat(row.longitude || row.lng || row.lon);
            const num = parseInt(row.number || row.num);

            if (isNaN(lat) || isNaN(lng)) {
                throw Object.assign(new Error(`Row ${i + 2}: invalid latitude/longitude`), { status: 400 });
            }
            return { latitude: lat, longitude: lng, ...(isNaN(num) ? {} : { number: num }) };
        });

        // Get current max number for auto-assignment
        const { data: maxRow } = await supabase
            .from('buildings')
            .select('number')
            .order('number', { ascending: false })
            .limit(1)
            .single();

        let nextNumber = (maxRow?.number || 0) + 1;
        const toInsert = buildings.map((b) => ({
            ...b,
            number: b.number || nextNumber++,
        }));

        // Chunk inserts (500 per batch for Supabase limits)
        const CHUNK = 500;
        let inserted = 0;
        for (let i = 0; i < toInsert.length; i += CHUNK) {
            const chunk = toInsert.slice(i, i + CHUNK);
            const { error } = await supabase.from('buildings').upsert(chunk, {
                onConflict: 'number',
                ignoreDuplicates: false,
            });
            if (error) throw error;
            inserted += chunk.length;
        }

        logger.info(`Imported ${inserted} buildings via CSV`);
        res.json({ message: `Successfully imported ${inserted} buildings`, inserted });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        next(err);
    }
});

// ─── GET /api/export ── download as CSV ─────────────────────
router.get('/export', authenticate, async (req, res, next) => {
    try {
        let allBuildings = [];
        let page = 0;
        const CHUNK = 1000;

        // Paginate through all buildings
        while (true) {
            const { data, error } = await supabase
                .from('buildings')
                .select('number, latitude, longitude, created_at, updated_at')
                .order('number', { ascending: true })
                .range(page * CHUNK, (page + 1) * CHUNK - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;

            allBuildings = allBuildings.concat(data);
            if (data.length < CHUNK) break;
            page++;
        }

        const csv = stringify(allBuildings, {
            header: true,
            columns: ['number', 'latitude', 'longitude', 'created_at', 'updated_at'],
        });

        const filename = `berbera_buildings_${new Date().toISOString().slice(0, 10)}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);

        logger.info(`Exported ${allBuildings.length} buildings as CSV`);
    } catch (err) {
        next(err);
    }
});

module.exports = router;

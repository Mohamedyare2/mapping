/**
 * Admin authentication route
 * POST /api/admin/login   — returns JWT token
 * GET  /api/admin/verify  — verify token validity
 */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// Store hashed password at startup
let hashedPassword = null;
(async () => {
    if (process.env.ADMIN_PASSWORD) {
        hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    } else {
        logger.warn('ADMIN_PASSWORD not set in environment variables!');
    }
})();

// ─── POST /api/admin/login ───────────────────────────────────
router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Check username
        if (username !== process.env.ADMIN_USERNAME) {
            await new Promise((r) => setTimeout(r, 500)); // Prevent timing attacks
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const valid = await bcrypt.compare(password, hashedPassword);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { username, role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        logger.info(`Admin login: ${username}`);
        res.json({
            token,
            expiresIn: process.env.JWT_EXPIRES_IN || '24h',
            username,
        });
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/admin/verify ───────────────────────────────────
router.get('/verify', authenticate, (req, res) => {
    res.json({ valid: true, username: req.user.username });
});

module.exports = router;

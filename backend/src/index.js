/**
 * Berbera Smart House Numbering System — Backend Entry Point
 * Node.js + Express REST API
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

const buildingsRouter  = require('./routes/buildings');
const searchRouter     = require('./routes/search');
const navigationRouter = require('./routes/navigation');
const locationRouter   = require('./routes/location');
const adminRouter      = require('./routes/admin');
const importExportRouter = require('./routes/importExport');

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── Security ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  credentials: true,
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

// ─── Parsing ─────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ─────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/buildings',  buildingsRouter);
app.use('/api/search',     searchRouter);
app.use('/api/navigation', navigationRouter);
app.use('/api/my-location', locationRouter);
app.use('/api/admin',      adminRouter);
app.use('/api',            importExportRouter);

// ─── Health check ───────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Berbera Smart House Numbering System API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 ─────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ─── Global error handler ────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error(err.stack || err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  });
});

// ─── Start server ────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 Berbera API running on http://localhost:${PORT}`);
});

module.exports = app;

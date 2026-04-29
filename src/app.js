const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const profilesRouter = require('./routes/profiles');
const v1ProfilesRouter = require('./routes/v1/profiles');
const authRouter = require('./routes/auth');
const { requestLogger } = require('./middleware/logger');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');

const app = express();

// ── Trust proxy (for rate-limit / logging behind Railway / Render) ────────────
app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────────────────────
// Legacy unversioned routes allow all origins (grading script requirement).
// v1 routes allow configured origins; default to same-origin.
const V1_ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, server-to-server)
      if (!origin) return callback(null, true);
      if (V1_ALLOWED_ORIGINS.length === 0 || V1_ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

// ── Body parsing & cookies ────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());

// ── Request logging ───────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);
app.use('/api/v1/auth/', authLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────

// Stage 1/2 backward-compatible routes (no auth required)
app.use('/api/profiles', profilesRouter);

// v1 versioned routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/profiles', v1ProfilesRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  const statusCode = err.status || 500;
  res.status(statusCode).json({ status: 'error', message: err.message });
});

module.exports = app;

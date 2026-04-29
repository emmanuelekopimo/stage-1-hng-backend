const rateLimit = require('express-rate-limit');

const windowMs = 15 * 60 * 1000; // 15-minute window

/**
 * Strict limiter for auth endpoints — prevents brute-force.
 */
const authLimiter = rateLimit({
  windowMs,
  max: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later' },
});

/**
 * General API limiter — applied to all /api/* routes.
 */
const apiLimiter = rateLimit({
  windowMs,
  max: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later' },
});

module.exports = { authLimiter, apiLimiter };

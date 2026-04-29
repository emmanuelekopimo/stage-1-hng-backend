const { verifyAccessToken } = require('../services/auth');

/**
 * Extract the Bearer token from Authorization header or the access_token cookie.
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  if (req.cookies && req.cookies.access_token) {
    return req.cookies.access_token;
  }
  return null;
}

/**
 * Middleware: verify JWT and attach req.user.
 * Responds 401 if token is missing or invalid.
 */
function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Authentication required' });
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
  }
}

/**
 * Middleware factory: require one of the given roles.
 * Must be used after authenticate().
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * CSRF protection for cookie-based sessions.
 * Skipped when the request uses Authorization: Bearer (CLI / API clients).
 *
 * Uses the double-submit cookie pattern:
 *   - Server sets a non-HTTP-only `csrf_token` cookie on login.
 *   - Client must echo it back via the `X-CSRF-Token` header.
 */
function csrfProtection(req, res, next) {
  // Bypass CSRF for Bearer token requests
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return next();
  }

  // Only enforce on state-mutating methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies && req.cookies.csrf_token;
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ status: 'error', message: 'CSRF token validation failed' });
  }

  next();
}

module.exports = { authenticate, requireRole, csrfProtection };

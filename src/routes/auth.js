const { Router } = require('express');
const crypto = require('crypto');
const {
  initiateOAuth,
  handleGitHubCallback,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeRefreshToken,
} = require('../services/auth');
const { authenticate } = require('../middleware/auth');

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

const REFRESH_COOKIE_TTL = 7 * 24 * 3600 * 1000; // 7 days

// ── GET /api/v1/auth/github/authorize ─────────────────────────────────────────
// Query params: state, code_challenge, code_challenge_method?, redirect_uri
router.get('/github/authorize', (req, res, next) => {
  try {
    const { state, code_challenge, code_challenge_method = 'S256', redirect_uri } = req.query;

    if (!state || !code_challenge || !redirect_uri) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameters: state, code_challenge, redirect_uri',
      });
    }

    if (code_challenge_method !== 'S256') {
      return res.status(400).json({
        status: 'error',
        message: 'Only S256 code_challenge_method is supported',
      });
    }

    const githubUrl = initiateOAuth({ state, codeChallenge: code_challenge, codeChallengeMethod: code_challenge_method, redirectUri: redirect_uri });

    return res.json({ status: 'success', data: { auth_url: githubUrl } });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/auth/github/callback ─────────────────────────────────────────
// GitHub redirects here: ?code=X&state=Y
router.get('/github/callback', async (req, res, next) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.status(400).json({ status: 'error', message: error_description || error });
    }

    if (!code || !state) {
      return res.status(400).json({ status: 'error', message: 'Missing code or state parameter' });
    }

    const { authCode, redirectUri } = await handleGitHubCallback(code, state);

    const target = new URL(redirectUri);
    target.searchParams.set('code', authCode);

    return res.redirect(target.toString());
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/token ───────────────────────────────────────────────────
// Body: { code, code_verifier, redirect_uri, client_type? }
// client_type = 'web' → set HTTP-only cookies; default = return tokens in JSON
router.post('/token', (req, res, next) => {
  try {
    const { code, code_verifier, redirect_uri, client_type } = req.body || {};

    if (!code || !code_verifier || !redirect_uri) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: code, code_verifier, redirect_uri',
      });
    }

    const tokens = exchangeCodeForTokens(code, code_verifier, redirect_uri);

    if (client_type === 'web') {
      // Issue CSRF token (non-HTTP-only, readable by JS)
      const csrfToken = crypto.randomBytes(24).toString('base64url');

      res.cookie('access_token', tokens.access_token, {
        ...COOKIE_OPTS,
        maxAge: tokens.expires_in * 1000,
      });
      res.cookie('refresh_token', tokens.refresh_token, {
        ...COOKIE_OPTS,
        maxAge: REFRESH_COOKIE_TTL,
      });
      res.cookie('csrf_token', csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: tokens.expires_in * 1000,
      });

      return res.json({
        status: 'success',
        data: {
          token_type: tokens.token_type,
          expires_in: tokens.expires_in,
        },
      });
    }

    return res.json({ status: 'success', data: tokens });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/refresh ─────────────────────────────────────────────────
// Body (JSON): { refresh_token }   OR cookie: refresh_token
router.post('/refresh', (req, res, next) => {
  try {
    const refreshToken =
      (req.body && req.body.refresh_token) ||
      (req.cookies && req.cookies.refresh_token);

    if (!refreshToken) {
      return res.status(400).json({ status: 'error', message: 'Missing refresh_token' });
    }

    const tokens = refreshAccessToken(refreshToken);
    const isWebClient = !!(req.cookies && req.cookies.refresh_token);

    if (isWebClient) {
      const csrfToken = crypto.randomBytes(24).toString('base64url');

      res.cookie('access_token', tokens.access_token, {
        ...COOKIE_OPTS,
        maxAge: tokens.expires_in * 1000,
      });
      res.cookie('refresh_token', tokens.refresh_token, {
        ...COOKIE_OPTS,
        maxAge: REFRESH_COOKIE_TTL,
      });
      res.cookie('csrf_token', csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: tokens.expires_in * 1000,
      });

      return res.json({
        status: 'success',
        data: { token_type: tokens.token_type, expires_in: tokens.expires_in },
      });
    }

    return res.json({ status: 'success', data: tokens });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/logout ──────────────────────────────────────────────────
// Revokes the refresh token.
router.post('/logout', (req, res, next) => {
  try {
    const refreshToken =
      (req.body && req.body.refresh_token) ||
      (req.cookies && req.cookies.refresh_token);

    if (refreshToken) {
      revokeRefreshToken(refreshToken);
    }

    // Clear cookies for web clients
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    res.clearCookie('csrf_token', { path: '/' });

    return res.json({ status: 'success', message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/auth/me ───────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  return res.json({
    status: 'success',
    data: {
      id: req.user.sub,
      username: req.user.username,
      role: req.user.role,
    },
  });
});

module.exports = router;

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v7: uuidv7 } = require('uuid');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'insighta-dev-secret-change-in-production';
const ACCESS_TOKEN_TTL = 15 * 60;        // 15 minutes in seconds
const REFRESH_TOKEN_TTL = 7 * 24 * 3600; // 7 days in seconds
const AUTH_CODE_TTL = 5 * 60 * 1000;     // 5 minutes in ms
const OAUTH_STATE_TTL = 10 * 60 * 1000;  // 10 minutes in ms

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

// ── Comma-separated list of GitHub usernames that get admin role ───────────────
const ADMIN_GITHUB_USERNAMES = (process.env.ADMIN_GITHUB_USERNAMES || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// ── PKCE helpers ──────────────────────────────────────────────────────────────

/**
 * Verify that SHA-256(code_verifier) == code_challenge (base64url encoded).
 */
function verifyPKCE(codeVerifier, codeChallenge) {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const computed = hash.toString('base64url');
  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(codeChallenge)
  );
}

// ── Token helpers ─────────────────────────────────────────────────────────────

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.github_username, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ── GitHub OAuth ──────────────────────────────────────────────────────────────

/**
 * Store a PKCE state/code_challenge pair, return the GitHub auth URL.
 */
function initiateOAuth({ state, codeChallenge, codeChallengeMethod = 'S256', redirectUri }) {
  if (!GITHUB_CLIENT_ID) {
    throw Object.assign(new Error('GITHUB_CLIENT_ID is not configured'), { status: 503 });
  }

  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL).toISOString();

  // Clean up expired states
  db.prepare("DELETE FROM oauth_states WHERE expires_at < datetime('now')").run();

  db.prepare(`
    INSERT OR REPLACE INTO oauth_states (id, state, code_challenge, code_challenge_method, redirect_uri, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(uuidv7(), state, codeChallenge, codeChallengeMethod, redirectUri, expiresAt);

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${BACKEND_URL}/api/v1/auth/github/callback`,
    scope: 'read:user user:email',
    state,
  });

  return `https://github.com/login/oauth/authorize?${params}`;
}

/**
 * Handle GitHub callback: exchange GitHub code, upsert user, issue our auth code.
 * Returns { authCode, redirectUri }.
 */
async function handleGitHubCallback(code, state) {
  // Look up state
  const oauthState = db.prepare(
    "SELECT * FROM oauth_states WHERE state = ? AND expires_at > datetime('now')"
  ).get(state);

  if (!oauthState) {
    throw Object.assign(new Error('Invalid or expired OAuth state'), { status: 400 });
  }

  // Delete consumed state
  db.prepare('DELETE FROM oauth_states WHERE id = ?').run(oauthState.id);

  if (!GITHUB_CLIENT_SECRET) {
    throw Object.assign(new Error('GITHUB_CLIENT_SECRET is not configured'), { status: 503 });
  }

  // Exchange code for GitHub access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${BACKEND_URL}/api/v1/auth/github/callback`,
    }),
  });

  if (!tokenRes.ok) {
    throw Object.assign(new Error('Failed to exchange GitHub code'), { status: 502 });
  }

  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    throw Object.assign(new Error(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`), { status: 400 });
  }

  const githubAccessToken = tokenData.access_token;

  // Get GitHub user info
  const [userRes, emailRes] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${githubAccessToken}`, 'User-Agent': 'InsightaLabs' },
    }),
    fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${githubAccessToken}`, 'User-Agent': 'InsightaLabs' },
    }),
  ]);

  if (!userRes.ok) {
    throw Object.assign(new Error('Failed to fetch GitHub user'), { status: 502 });
  }

  const githubUser = await userRes.json();
  let email = githubUser.email;

  if (!email && emailRes.ok) {
    const emails = await emailRes.json();
    const primary = emails.find((e) => e.primary && e.verified);
    email = primary ? primary.email : (emails[0] ? emails[0].email : null);
  }

  // Upsert user
  const role = ADMIN_GITHUB_USERNAMES.includes(githubUser.login.toLowerCase())
    ? 'admin'
    : 'analyst';

  const existing = db.prepare('SELECT * FROM users WHERE github_id = ?').get(githubUser.id);

  let user;
  if (existing) {
    // Update username / email but preserve role (unless they're listed in admin list)
    const updatedRole = ADMIN_GITHUB_USERNAMES.includes(githubUser.login.toLowerCase())
      ? 'admin'
      : existing.role;
    db.prepare(`
      UPDATE users SET github_username = ?, github_email = ?, role = ? WHERE github_id = ?
    `).run(githubUser.login, email, updatedRole, githubUser.id);
    user = db.prepare('SELECT * FROM users WHERE github_id = ?').get(githubUser.id);
  } else {
    const newId = uuidv7();
    db.prepare(`
      INSERT INTO users (id, github_id, github_username, github_email, role, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(newId, githubUser.id, githubUser.login, email, role);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(newId);
  }

  // Issue short-lived auth code
  const authCode = crypto.randomBytes(32).toString('base64url');
  const codeExpiresAt = new Date(Date.now() + AUTH_CODE_TTL).toISOString();

  // Clean up expired auth codes
  db.prepare("DELETE FROM auth_codes WHERE expires_at < datetime('now')").run();

  db.prepare(`
    INSERT INTO auth_codes (id, code, user_id, code_challenge, redirect_uri, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(uuidv7(), authCode, user.id, oauthState.code_challenge, oauthState.redirect_uri, codeExpiresAt);

  return { authCode, redirectUri: oauthState.redirect_uri };
}

/**
 * Exchange auth code + code_verifier for access + refresh tokens.
 */
function exchangeCodeForTokens(code, codeVerifier, redirectUri) {
  const authCode = db.prepare(
    "SELECT * FROM auth_codes WHERE code = ? AND expires_at > datetime('now')"
  ).get(code);

  if (!authCode) {
    throw Object.assign(new Error('Invalid or expired authorization code'), { status: 400 });
  }

  if (authCode.redirect_uri !== redirectUri) {
    throw Object.assign(new Error('redirect_uri mismatch'), { status: 400 });
  }

  // Verify PKCE
  let pkceValid = false;
  try {
    pkceValid = verifyPKCE(codeVerifier, authCode.code_challenge);
  } catch {
    // timingSafeEqual throws if buffers differ in length
    pkceValid = false;
  }

  if (!pkceValid) {
    throw Object.assign(new Error('PKCE verification failed'), { status: 400 });
  }

  // Consume the auth code
  db.prepare('DELETE FROM auth_codes WHERE id = ?').run(authCode.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(authCode.user_id);
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  return issueTokenPair(user);
}

/**
 * Issue a new access + refresh token pair for a user.
 */
function issueTokenPair(user) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  const refreshHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000).toISOString();

  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(uuidv7(), user.id, refreshHash, expiresAt);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL,
  };
}

/**
 * Rotate refresh token: revoke old one, issue new pair.
 */
function refreshAccessToken(refreshToken) {
  const hash = hashToken(refreshToken);
  const stored = db.prepare(
    "SELECT rt.*, u.id as uid FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = ? AND rt.expires_at > datetime('now')"
  ).get(hash);

  if (!stored) {
    throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });
  }

  // Revoke old token (rotation)
  db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(stored.user_id);
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  return issueTokenPair(user);
}

/**
 * Revoke a refresh token (logout).
 */
function revokeRefreshToken(refreshToken) {
  const hash = hashToken(refreshToken);
  const result = db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hash);
  return result.changes > 0;
}

/**
 * Revoke all refresh tokens for a user.
 */
function revokeAllRefreshTokens(userId) {
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
}

module.exports = {
  verifyAccessToken,
  initiateOAuth,
  handleGitHubCallback,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
};

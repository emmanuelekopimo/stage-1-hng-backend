# Insighta Labs+ — Backend API

A secure, multi-interface Profile Intelligence System built with Node.js, Express, and SQLite.  
This is the backend service shared by the **CLI tool** and **Web Portal** — one source of truth across all interfaces.

---

## System Architecture

```
┌────────────────────────────────────────────────────────┐
│                    Insighta Labs+                      │
│                                                        │
│  ┌─────────────┐        ┌──────────────────────────┐  │
│  │  CLI Tool   │──────▶ │     Backend REST API      │  │
│  │ (npm pkg)   │        │   (Express + SQLite)      │  │
│  └─────────────┘        │                           │  │
│                         │  /api/v1/auth/*           │  │
│  ┌─────────────┐        │  /api/v1/profiles/*       │  │
│  │ Web Portal  │──────▶ │  /api/profiles/* (legacy) │  │
│  │  (React/    │        │                           │  │
│  │   vanilla)  │        └──────────────────────────-┘  │
│  └─────────────┘                    │                  │
│                                     ▼                  │
│                          ┌──────────────────┐          │
│                          │  SQLite Database │          │
│                          │  profiles        │          │
│                          │  users           │          │
│                          │  refresh_tokens  │          │
│                          │  oauth_states    │          │
│                          │  auth_codes      │          │
│                          └──────────────────┘          │
└────────────────────────────────────────────────────────┘
```

**Stack:**
- Runtime: Node.js 20+
- Framework: Express 5
- Database: SQLite (`better-sqlite3`) at `/data/database.sqlite`
- Auth: GitHub OAuth 2.0 + PKCE, JWT (access) + opaque tokens (refresh)
- Package Manager: pnpm

---

## Authentication & Auth Flow

### GitHub OAuth + PKCE

PKCE (Proof Key for Code Exchange) prevents authorization code interception attacks.

```
Client (CLI / Browser)              Backend                   GitHub
       │                               │                         │
       │ 1. Generate:                  │                         │
       │    code_verifier (random)     │                         │
       │    code_challenge = B64(SHA256(code_verifier))         │
       │    state (random)             │                         │
       │                               │                         │
       │──GET /auth/github/authorize──▶│                         │
       │  ?state=S                     │                         │
       │  &code_challenge=C            │ 2. Store state+         │
       │  &redirect_uri=R              │    code_challenge       │
       │                               │──────────────────────▶  │
       │◀── { auth_url } ─────────────│  3. GitHub OAuth URL    │
       │                               │                         │
       │ 4. Browser opens auth_url     │                         │
       │──────────────────────────────────────────────────────▶ │
       │                               │  5. User authenticates  │
       │                               │◀──────────────────────  │
       │                               │  GET /callback?code=X   │
       │                               │  &state=S               │
       │                               │                         │
       │                               │ 6. Exchange GH code     │
       │                               │    Upsert user          │
       │                               │    Issue auth_code      │
       │◀── Redirect ?code=AUTH_CODE ──│                         │
       │                               │                         │
       │──POST /auth/token ────────────▶                         │
       │  { code, code_verifier,        │ 7. Verify PKCE          │
       │    redirect_uri }              │    Issue JWT + refresh  │
       │◀── { access_token,             │                         │
       │      refresh_token }──────────│                         │
```

### Token Handling

| Token | Type | TTL | Storage |
|-------|------|-----|---------|
| `access_token` | JWT (HS256) | 15 minutes | CLI: file; Web: HTTP-only cookie |
| `refresh_token` | Opaque (random bytes) | 7 days | CLI: file; Web: HTTP-only cookie |

- Access tokens are short-lived JWTs containing `{ sub, username, role }`.
- Refresh tokens are random 48-byte base64url strings stored as SHA-256 hashes in the database.
- Refresh token rotation: issuing a new pair always revokes the previous refresh token.

### Storing Credentials (CLI)

The CLI stores credentials at `~/.insighta/credentials.json`:

```json
{
  "access_token": "eyJ...",
  "refresh_token": "Xk9...",
  "expires_at": "2026-04-29T20:00:00Z"
}
```

---

## Role Enforcement

Two roles are supported: **admin** and **analyst**.

| Endpoint | analyst | admin |
|----------|---------|-------|
| `GET /api/v1/profiles` | ✅ | ✅ |
| `GET /api/v1/profiles/search` | ✅ | ✅ |
| `GET /api/v1/profiles/:id` | ✅ | ✅ |
| `GET /api/v1/profiles/export` | ✅ | ✅ |
| `POST /api/v1/profiles` | ❌ | ✅ |
| `DELETE /api/v1/profiles/:id` | ❌ | ✅ |

Roles are assigned at login time:
- If a user's GitHub username is in `ADMIN_GITHUB_USERNAMES` (env var, comma-separated) → `admin`
- Otherwise → `analyst`
- Existing users' roles are updated on every login if they appear in the admin list.

Role enforcement is implemented as Express middleware (`requireRole('admin')`), applied per-route.

---

## API Reference

### Authentication Endpoints

All auth endpoints are under `/api/v1/auth/` and subject to a 30 requests/15min rate limit.

#### `GET /api/v1/auth/github/authorize`

Initiates the OAuth + PKCE flow. Returns the GitHub authorization URL.

**Query params:**

| Param | Required | Description |
|-------|----------|-------------|
| `state` | ✅ | Random CSRF state |
| `code_challenge` | ✅ | `BASE64URL(SHA256(code_verifier))` |
| `code_challenge_method` | ❌ | Must be `S256` (default) |
| `redirect_uri` | ✅ | Where to send the authorization code |

**Response:**
```json
{ "status": "success", "data": { "auth_url": "https://github.com/login/oauth/authorize?..." } }
```

#### `GET /api/v1/auth/github/callback`

GitHub redirects here. Exchanges GitHub code for a backend authorization code and redirects to `redirect_uri?code=AUTH_CODE`.

#### `POST /api/v1/auth/token`

Exchange authorization code + PKCE verifier for access + refresh tokens.

**Body:**
```json
{
  "code": "AUTH_CODE",
  "code_verifier": "ORIGINAL_VERIFIER",
  "redirect_uri": "http://localhost:8765/callback",
  "client_type": "cli"
}
```

Set `client_type: "web"` for the web portal — tokens are set in HTTP-only cookies instead of being returned in JSON.

**Response (CLI):**
```json
{
  "status": "success",
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "Xk9...",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

#### `POST /api/v1/auth/refresh`

Refresh an expired access token. Accepts `refresh_token` in the JSON body (CLI) or from cookies (web portal).

**Body:**
```json
{ "refresh_token": "Xk9..." }
```

#### `POST /api/v1/auth/logout`

Revoke the refresh token. Clears cookies for web clients.

#### `GET /api/v1/auth/me`

Returns the authenticated user's info. Requires `Authorization: Bearer <access_token>`.

**Response:**
```json
{
  "status": "success",
  "data": { "id": "...", "username": "octocat", "role": "admin" }
}
```

---

### Profile Endpoints (v1 — authenticated)

All endpoints under `/api/v1/profiles/` require a valid `Authorization: Bearer` header or `access_token` cookie.

#### `GET /api/v1/profiles`

List profiles with filtering, sorting, and pagination.

**Query params:** `gender`, `country_id`, `age_group`, `min_age`, `max_age`, `min_gender_probability`, `min_country_probability`, `sort_by` (age|created_at|gender_probability), `order` (asc|desc), `page`, `limit` (1–50)

**Response:**
```json
{
  "status": "success",
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 2026,
    "totalPages": 203
  }
}
```

#### `GET /api/v1/profiles/search?q=<query>`

Natural language profile search. Examples: `"young women from Nigeria"`, `"senior men above 70"`.

#### `GET /api/v1/profiles/export`

Download all matching profiles as CSV. Accepts same filter params as `GET /api/v1/profiles`. Returns `text/csv`.

#### `GET /api/v1/profiles/:id`

Get a single profile by UUID.

#### `POST /api/v1/profiles` _(admin only)_

Create a profile by enriching a name via external APIs (Genderize, Agify, Nationalize).

**Body:** `{ "name": "alice" }`

#### `DELETE /api/v1/profiles/:id` _(admin only)_

Delete a profile. Returns `204 No Content`.

---

### Legacy Endpoints (Stage 1/2 — no auth required)

All original endpoints remain at `/api/profiles` without authentication for backward compatibility.

---

## Natural Language Query Parsing

The `/search` endpoint uses a rule-based NLP parser (no AI) to translate queries into structured filters.

| Query term | Filter applied |
|-----------|----------------|
| `"male"`, `"man"`, `"men"` | `gender=male` |
| `"female"`, `"woman"`, `"women"`, `"girl"` | `gender=female` |
| `"young"` | `min_age=16`, `max_age=24` |
| `"teenager(s)"` | `age_group=teenager` |
| `"child"`, `"children"` | `age_group=child` |
| `"adult(s)"` | `age_group=adult` |
| `"senior(s)"`, `"elderly"` | `age_group=senior` |
| `"above N"`, `"over N"` | `min_age=N` |
| `"below N"`, `"under N"` | `max_age=N` |
| Country name/adjective | `country_id=ISO` (140+ mappings) |

---

## Web Portal — Security

For the web portal, the backend uses:

- **HTTP-only cookies** for `access_token` and `refresh_token` (inaccessible to JavaScript)
- **CSRF protection** via the double-submit cookie pattern:
  - A non-HTTP-only `csrf_token` cookie is set on login
  - State-mutating requests (POST, PUT, DELETE, PATCH) must echo the value in the `X-CSRF-Token` header
  - Bearer token requests (CLI/API) bypass CSRF checks automatically

---

## Rate Limiting

| Scope | Limit |
|-------|-------|
| Auth endpoints (`/api/v1/auth/*`) | 30 req / 15 min |
| All API endpoints (`/api/*`) | 300 req / 15 min |

Rate limit headers follow RFC draft-7 (`RateLimit-*`).

---

## Running Locally

```bash
pnpm install
pnpm start
```

**Environment variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP port |
| `DB_PATH` | No | `/data/database.sqlite` | SQLite file path |
| `JWT_SECRET` | **Yes (prod)** | `insighta-dev-secret-...` | JWT signing secret |
| `GITHUB_CLIENT_ID` | **Yes** | — | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | **Yes** | — | GitHub OAuth App secret |
| `BACKEND_URL` | No | `http://localhost:3000` | Public URL (used for callback) |
| `ADMIN_GITHUB_USERNAMES` | No | `""` | Comma-separated admin GitHub usernames |
| `ALLOWED_ORIGINS` | No | `""` | Comma-separated CORS origins for v1 API |
| `NODE_ENV` | No | — | Set to `production` for secure cookies |

---

## CI/CD

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and pull request to:

1. Install dependencies (`pnpm install`)
2. Start the server
3. Smoke-test key endpoints

---

## Deployment (Railway / Render)

1. Set all required environment variables in the platform dashboard.
2. Mount a persistent volume at `/data` and set `DB_PATH=/data/database.sqlite`.
3. The app seeds 2026 profiles on first startup automatically.

---

## Repository Links

- **Backend**: this repository
- **CLI**: `insighta` npm package (separate repository)
- **Web Portal**: Insighta Labs+ Portal (separate repository)


# Stage 1 HNG Backend — Profile Intelligence Service

A RESTful API built with Node.js, Express, and SQLite that enriches names using external APIs and persists the results.

## Stack

- **Runtime**: Node.js
- **Framework**: Express 5
- **Database**: SQLite (`better-sqlite3`) at `/data/database.sqlite`
- **Package Manager**: pnpm

## External APIs

- [Genderize](https://api.genderize.io) — gender prediction
- [Agify](https://api.agify.io) — age prediction
- [Nationalize](https://api.nationalize.io) — nationality prediction

## Endpoints

### POST `/api/profiles`

Creates a profile by enriching the given name with external API data.

**Request Body:**
```json
{ "name": "ella" }
```

**Success (201):**
```json
{
  "status": "success",
  "data": {
    "id": "uuid-v7",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 46,
    "age_group": "adult",
    "country_id": "DRC",
    "country_probability": 0.85,
    "created_at": "2026-04-01T12:00:00Z"
  }
}
```

**Idempotent** — if the name already exists, returns the existing profile with a `"Profile already exists"` message.

---

### GET `/api/profiles`

Returns all profiles, with optional case-insensitive filters.

**Query params:** `gender`, `country_id`, `age_group`

---

### GET `/api/profiles/:id`

Returns a single profile by UUID.

---

### DELETE `/api/profiles/:id`

Deletes a profile. Returns `204 No Content` on success.

## Error Responses

All errors follow:
```json
{ "status": "error", "message": "<error message>" }
```

502 errors from invalid external API responses follow:
```json
{ "status": "502", "message": "<API name> returned an invalid response" }
```

## Running Locally

```bash
pnpm install
pnpm start
```

Set `PORT` (default `3000`) and `DB_PATH` (default `/data/database.sqlite`) environment variables as needed.

## Deployment (Railway)

Set `DB_PATH=/data/database.sqlite` in Railway environment variables and mount a persistent volume at `/data`.

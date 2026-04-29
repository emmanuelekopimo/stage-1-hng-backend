const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || '/data/database.sqlite';

// Ensure directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Profiles table ───────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    gender TEXT,
    gender_probability REAL,
    age INTEGER,
    age_group TEXT,
    country_id TEXT,
    country_name TEXT,
    country_probability REAL,
    created_at TEXT NOT NULL
  )
`);

// Migration: add country_name if it doesn't exist (for existing databases)
const existingColumns = db.pragma('table_info(profiles)').map((c) => c.name);
if (!existingColumns.includes('country_name')) {
  db.exec('ALTER TABLE profiles ADD COLUMN country_name TEXT');
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_profiles_gender     ON profiles(gender);
  CREATE INDEX IF NOT EXISTS idx_profiles_age_group  ON profiles(age_group);
  CREATE INDEX IF NOT EXISTS idx_profiles_country_id ON profiles(country_id);
  CREATE INDEX IF NOT EXISTS idx_profiles_age        ON profiles(age);
  CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);
`);

// ── Users table ───────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    github_id INTEGER UNIQUE NOT NULL,
    github_username TEXT UNIQUE NOT NULL,
    github_email TEXT,
    role TEXT NOT NULL DEFAULT 'analyst',
    created_at TEXT NOT NULL
  )
`);

// ── Refresh tokens table ──────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id   ON refresh_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
`);

// ── OAuth PKCE states table ───────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS oauth_states (
    id TEXT PRIMARY KEY,
    state TEXT UNIQUE NOT NULL,
    code_challenge TEXT NOT NULL,
    code_challenge_method TEXT NOT NULL DEFAULT 'S256',
    redirect_uri TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

// ── Auth codes table (short-lived codes issued after GitHub callback) ─────────

db.exec(`
  CREATE TABLE IF NOT EXISTS auth_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

module.exports = db;

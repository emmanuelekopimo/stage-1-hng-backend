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

// Create profiles table with required schema
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

// Indexes for frequently filtered / sorted columns
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_profiles_gender     ON profiles(gender);
  CREATE INDEX IF NOT EXISTS idx_profiles_age_group  ON profiles(age_group);
  CREATE INDEX IF NOT EXISTS idx_profiles_country_id ON profiles(country_id);
  CREATE INDEX IF NOT EXISTS idx_profiles_age        ON profiles(age);
  CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);
`);

module.exports = db;

const { v7: uuidv7 } = require('uuid');
const db = require('../db');


const GENDERIZE_URL = 'https://api.genderize.io';
const AGIFY_URL = 'https://api.agify.io';
const NATIONALIZE_URL = 'https://api.nationalize.io';

function classifyAgeGroup(age) {
  if (age >= 0 && age <= 12) return 'child';
  if (age >= 13 && age <= 19) return 'teenager';
  if (age >= 20 && age <= 59) return 'adult';
  return 'senior';
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function enrichProfile(name) {
  const [genderData, agifyData, nationalizeData] = await Promise.all([
    fetchJson(`${GENDERIZE_URL}?name=${encodeURIComponent(name)}`),
    fetchJson(`${AGIFY_URL}?name=${encodeURIComponent(name)}`),
    fetchJson(`${NATIONALIZE_URL}?name=${encodeURIComponent(name)}`),
  ]);

  // Validate Genderize response
  if (!genderData.gender || !genderData.count) {
    const err = new Error('Genderize returned an invalid response');
    err.status = 502;
    err.api = 'Genderize';
    throw err;
  }

  // Validate Agify response
  if (agifyData.age === null || agifyData.age === undefined) {
    const err = new Error('Agify returned an invalid response');
    err.status = 502;
    err.api = 'Agify';
    throw err;
  }

  // Validate Nationalize response
  if (!nationalizeData.country || nationalizeData.country.length === 0) {
    const err = new Error('Nationalize returned an invalid response');
    err.status = 502;
    err.api = 'Nationalize';
    throw err;
  }

  // Pick country with highest probability
  const topCountry = nationalizeData.country.reduce((prev, curr) =>
    curr.probability > prev.probability ? curr : prev
  );

  const age = agifyData.age;

  return {
    id: uuidv7(),
    name,
    gender: genderData.gender,
    gender_probability: genderData.probability,
    sample_size: genderData.count,
    age,
    age_group: classifyAgeGroup(age),
    country_id: topCountry.country_id,
    country_probability: topCountry.probability,
    // UTC ISO 8601 without milliseconds, e.g. "2026-04-01T12:00:00Z"
    created_at: new Date().toISOString().split('.')[0] + 'Z',
  };
}

function createProfile(profileData) {
  const stmt = db.prepare(`
    INSERT INTO profiles
      (id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_probability, created_at)
    VALUES
      (@id, @name, @gender, @gender_probability, @sample_size, @age, @age_group, @country_id, @country_probability, @created_at)
  `);
  stmt.run(profileData);
  return profileData;
}

function getProfileByName(name) {
  return db.prepare('SELECT * FROM profiles WHERE LOWER(name) = LOWER(?)').get(name);
}

function getProfileById(id) {
  return db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
}

function getProfiles(filters = {}) {
  let query = 'SELECT * FROM profiles WHERE 1=1';
  const params = [];

  if (filters.gender) {
    query += ' AND LOWER(gender) = LOWER(?)';
    params.push(filters.gender);
  }
  if (filters.country_id) {
    query += ' AND LOWER(country_id) = LOWER(?)';
    params.push(filters.country_id);
  }
  if (filters.age_group) {
    query += ' AND LOWER(age_group) = LOWER(?)';
    params.push(filters.age_group);
  }

  return db.prepare(query).all(...params);
}

function deleteProfile(id) {
  const result = db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = {
  enrichProfile,
  createProfile,
  getProfileByName,
  getProfileById,
  getProfiles,
  deleteProfile,
};

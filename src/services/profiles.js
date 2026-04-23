const { v7: uuidv7 } = require('uuid');
const db = require('../db');
const { getCountryName } = require('../utils/countries');
const { parseNLQuery } = require('./nlp');

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
    age,
    age_group: classifyAgeGroup(age),
    country_id: topCountry.country_id,
    country_name: getCountryName(topCountry.country_id),
    country_probability: topCountry.probability,
    created_at: new Date().toISOString().split('.')[0] + 'Z',
  };
}

function createProfile(profileData) {
  const stmt = db.prepare(`
    INSERT INTO profiles
      (id, name, gender, gender_probability, age, age_group,
       country_id, country_name, country_probability, created_at)
    VALUES
      (@id, @name, @gender, @gender_probability, @age, @age_group,
       @country_id, @country_name, @country_probability, @created_at)
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

/**
 * Query profiles with optional filtering, sorting, and pagination.
 *
 * @param {object} options
 * @param {object} [options.filters]       - Field filter values
 * @param {object} [options.sort]          - { sort_by, order }
 * @param {object} [options.pagination]    - { page, limit }
 * @returns {{ total: number, page: number, limit: number, data: object[] }}
 */
function getProfiles({ filters = {}, sort = {}, pagination = {} } = {}) {
  const ALLOWED_SORT = ['age', 'created_at', 'gender_probability'];
  const sortBy = ALLOWED_SORT.includes(sort.sort_by) ? sort.sort_by : 'created_at';
  const order = sort.order === 'asc' ? 'ASC' : 'DESC';

  const page = Math.max(1, pagination.page || 1);
  const limit = Math.min(50, Math.max(1, pagination.limit || 10));
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params = [];

  if (filters.gender) {
    where += ' AND LOWER(gender) = LOWER(?)';
    params.push(filters.gender);
  }
  if (filters.country_id) {
    where += ' AND LOWER(country_id) = LOWER(?)';
    params.push(filters.country_id);
  }
  if (filters.age_group) {
    where += ' AND LOWER(age_group) = LOWER(?)';
    params.push(filters.age_group);
  }
  if (filters.min_age !== undefined) {
    where += ' AND age >= ?';
    params.push(filters.min_age);
  }
  if (filters.max_age !== undefined) {
    where += ' AND age <= ?';
    params.push(filters.max_age);
  }
  if (filters.min_gender_probability !== undefined) {
    where += ' AND gender_probability >= ?';
    params.push(filters.min_gender_probability);
  }
  if (filters.min_country_probability !== undefined) {
    where += ' AND country_probability >= ?';
    params.push(filters.min_country_probability);
  }

  const total = db
    .prepare(`SELECT COUNT(*) AS total FROM profiles ${where}`)
    .get(...params).total;

  const data = db
    .prepare(
      `SELECT * FROM profiles ${where} ORDER BY ${sortBy} ${order} LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return { total, page, limit, data };
}

/**
 * Natural-language profile search.
 * Parses the query string into filters via rule-based NLP, then delegates to getProfiles.
 *
 * @returns {{ total, page, limit, data }} or null when the query cannot be interpreted
 */
function searchProfiles({ q, page, limit }) {
  const filters = parseNLQuery(q);
  if (!filters) return null;

  return getProfiles({ filters, sort: {}, pagination: { page, limit } });
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
  searchProfiles,
  deleteProfile,
};

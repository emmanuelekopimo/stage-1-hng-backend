const { findCountryInQuery } = require('../utils/countries');

/**
 * Parse a natural-language query string into a structured filter object.
 *
 * Returns an object with one or more of:
 *   { gender, age_group, country_id, min_age, max_age }
 *
 * Returns null if no recognisable terms could be extracted.
 *
 * Mapping rules (rule-based only, no AI):
 *   "young"          → min_age=16 + max_age=24  (not a stored age_group)
 *   "teenager(s)"    → age_group=teenager
 *   "child/children" → age_group=child
 *   "adult(s)"       → age_group=adult
 *   "senior(s)"      → age_group=senior
 *   "above/over N"   → min_age=N  (overrides young's min_age)
 *   "below/under N"  → max_age=N  (overrides young's max_age)
 *   "male(s)/man/men"          → gender=male  (only when female absent)
 *   "female(s)/woman/women"    → gender=female (only when male absent)
 *   "from/in [country]"        → country_id=<ISO>
 *   "[country adjective]"      → country_id=<ISO>
 */
function parseNLQuery(q) {
  const lower = q.toLowerCase().trim();
  const filters = {};

  // ── Gender ────────────────────────────────────────────────────────────────
  const hasMale = /\b(male|males|man|men)\b/.test(lower);
  const hasFemale = /\b(female|females|woman|women|girl|girls)\b/.test(lower);
  if (hasMale && !hasFemale) filters.gender = 'male';
  else if (hasFemale && !hasMale) filters.gender = 'female';
  // Both present → no gender filter (e.g. "male and female teenagers")

  // ── Age group / "young" ───────────────────────────────────────────────────
  if (/\byoung\b/.test(lower)) {
    filters.min_age = 16;
    filters.max_age = 24;
  } else if (/\bteen(ager)?s?\b/.test(lower)) {
    filters.age_group = 'teenager';
  } else if (/\b(child(ren)?|kids?)\b/.test(lower)) {
    filters.age_group = 'child';
  } else if (/\badults?\b/.test(lower)) {
    filters.age_group = 'adult';
  } else if (/\b(seniors?|elderly)\b/.test(lower)) {
    filters.age_group = 'senior';
  }

  // ── Numeric age bounds (override / supplement young's bounds) ─────────────
  const aboveMatch = lower.match(/\b(above|over)\s+(\d+)\b/);
  if (aboveMatch) {
    filters.min_age = parseInt(aboveMatch[2], 10);
  }
  const belowMatch = lower.match(/\b(below|under)\s+(\d+)\b/);
  if (belowMatch) {
    filters.max_age = parseInt(belowMatch[2], 10);
  }

  // ── Country ───────────────────────────────────────────────────────────────
  const countryId = findCountryInQuery(lower);
  if (countryId) filters.country_id = countryId;

  // ── Interpretability check ────────────────────────────────────────────────
  const hasAnyFilter = (
    filters.gender ||
    filters.age_group ||
    filters.min_age !== undefined ||
    filters.max_age !== undefined ||
    filters.country_id
  );

  return hasAnyFilter ? filters : null;
}

module.exports = { parseNLQuery };

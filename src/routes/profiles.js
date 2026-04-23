const { Router } = require('express');
const {
  enrichProfile,
  createProfile,
  getProfileByName,
  getProfileById,
  getProfiles,
  searchProfiles,
  deleteProfile,
} = require('../services/profiles');

const router = Router();

// ── Validation helpers ────────────────────────────────────────────────────────

const VALID_GENDERS = ['male', 'female'];
const VALID_AGE_GROUPS = ['child', 'teenager', 'adult', 'senior'];
const VALID_SORT_BY = ['age', 'created_at', 'gender_probability'];
const VALID_ORDERS = ['asc', 'desc'];

/**
 * Parse and validate common query parameters for GET /api/profiles.
 * Returns { filters, sort, pagination } or throws { isValidationError: true }.
 */
function parseProfilesQuery(query) {
  const {
    gender, country_id, age_group,
    min_age, max_age, min_gender_probability, min_country_probability,
    sort_by, order, page, limit,
  } = query;

  // ── Enum checks ─────────────────────────────────────────────────────────
  if (gender !== undefined && !VALID_GENDERS.includes(gender.toLowerCase())) {
    return null;
  }
  if (age_group !== undefined && !VALID_AGE_GROUPS.includes(age_group.toLowerCase())) {
    return null;
  }
  if (sort_by !== undefined && !VALID_SORT_BY.includes(sort_by)) {
    return null;
  }
  if (order !== undefined && !VALID_ORDERS.includes(order.toLowerCase())) {
    return null;
  }

  // ── Numeric checks ───────────────────────────────────────────────────────
  let minAge, maxAge, minGP, minCP, pageNum, limitNum;

  if (min_age !== undefined) {
    minAge = parseInt(min_age, 10);
    if (isNaN(minAge) || minAge < 0) return null;
  }
  if (max_age !== undefined) {
    maxAge = parseInt(max_age, 10);
    if (isNaN(maxAge) || maxAge < 0) return null;
  }
  if (min_gender_probability !== undefined) {
    minGP = parseFloat(min_gender_probability);
    if (isNaN(minGP) || minGP < 0 || minGP > 1) return null;
  }
  if (min_country_probability !== undefined) {
    minCP = parseFloat(min_country_probability);
    if (isNaN(minCP) || minCP < 0 || minCP > 1) return null;
  }

  pageNum = page !== undefined ? parseInt(page, 10) : 1;
  if (isNaN(pageNum) || pageNum < 1) return null;

  limitNum = limit !== undefined ? parseInt(limit, 10) : 10;
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) return null;

  // ── Build structured objects ─────────────────────────────────────────────
  const filters = {};
  if (gender) filters.gender = gender.toLowerCase();
  if (country_id) filters.country_id = country_id;
  if (age_group) filters.age_group = age_group.toLowerCase();
  if (minAge !== undefined) filters.min_age = minAge;
  if (maxAge !== undefined) filters.max_age = maxAge;
  if (minGP !== undefined) filters.min_gender_probability = minGP;
  if (minCP !== undefined) filters.min_country_probability = minCP;

  return {
    filters,
    sort: { sort_by, order },
    pagination: { page: pageNum, limit: limitNum },
  };
}

// ── POST /api/profiles ────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;

    if (name === undefined || name === null || name === '') {
      return res.status(400).json({ status: 'error', message: 'Missing or empty name' });
    }
    if (typeof name !== 'string') {
      return res.status(422).json({ status: 'error', message: 'Invalid type: name must be a string' });
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return res.status(400).json({ status: 'error', message: 'Missing or empty name' });
    }

    const existing = getProfileByName(trimmedName);
    if (existing) {
      return res.status(201).json({
        status: 'success',
        message: 'Profile already exists',
        data: existing,
      });
    }

    const profileData = await enrichProfile(trimmedName);
    const profile = createProfile(profileData);

    return res.status(201).json({ status: 'success', data: profile });
  } catch (err) {
    if (err.status === 502) {
      return res.status(502).json({ status: '502', message: err.message });
    }
    next(err);
  }
});

// ── GET /api/profiles/search  (must be before /:id) ──────────────────────────
router.get('/search', (req, res, next) => {
  try {
    const { q, page, limit } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({ status: 'error', message: 'Unable to interpret query' });
    }

    let pageNum = page !== undefined ? parseInt(page, 10) : 1;
    let limitNum = limit !== undefined ? parseInt(limit, 10) : 10;

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ status: 'error', message: 'Invalid query parameters' });
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({ status: 'error', message: 'Invalid query parameters' });
    }

    const result = searchProfiles({ q: q.trim(), page: pageNum, limit: limitNum });

    if (!result) {
      return res.status(400).json({ status: 'error', message: 'Unable to interpret query' });
    }

    return res.status(200).json({
      status: 'success',
      page: result.page,
      limit: result.limit,
      total: result.total,
      data: result.data,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/profiles ────────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const parsed = parseProfilesQuery(req.query);
    if (!parsed) {
      return res.status(400).json({ status: 'error', message: 'Invalid query parameters' });
    }

    const result = getProfiles(parsed);

    return res.status(200).json({
      status: 'success',
      page: result.page,
      limit: result.limit,
      total: result.total,
      data: result.data,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/profiles/:id ────────────────────────────────────────────────────
router.get('/:id', (req, res, next) => {
  try {
    const profile = getProfileById(req.params.id);
    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }
    return res.status(200).json({ status: 'success', data: profile });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/profiles/:id ─────────────────────────────────────────────────
router.delete('/:id', (req, res, next) => {
  try {
    const deleted = deleteProfile(req.params.id);
    if (!deleted) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;

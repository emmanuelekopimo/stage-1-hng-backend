const { Router } = require('express');
const {
  enrichProfile,
  createProfile,
  getProfileByName,
  getProfileById,
  getProfiles,
  searchProfiles,
  deleteProfile,
} = require('../../services/profiles');
const { authenticate, requireRole, csrfProtection } = require('../../middleware/auth');

const router = Router();

// All v1 profile routes require authentication
router.use(authenticate);

// State-mutating routes require CSRF protection for cookie-based clients
router.use(csrfProtection);

// ── Validation helpers ────────────────────────────────────────────────────────

const VALID_GENDERS = ['male', 'female'];
const VALID_AGE_GROUPS = ['child', 'teenager', 'adult', 'senior'];
const VALID_SORT_BY = ['age', 'created_at', 'gender_probability'];
const VALID_ORDERS = ['asc', 'desc'];

function parseProfilesQuery(query) {
  const {
    gender, country_id, age_group,
    min_age, max_age, min_gender_probability, min_country_probability,
    sort_by, order, page, limit,
  } = query;

  if (gender !== undefined && !VALID_GENDERS.includes(gender.toLowerCase())) return null;
  if (age_group !== undefined && !VALID_AGE_GROUPS.includes(age_group.toLowerCase())) return null;
  if (sort_by !== undefined && !VALID_SORT_BY.includes(sort_by)) return null;
  if (order !== undefined && !VALID_ORDERS.includes(order.toLowerCase())) return null;

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

  const filters = {};
  if (gender) filters.gender = gender.toLowerCase();
  if (country_id) filters.country_id = country_id;
  if (age_group) filters.age_group = age_group.toLowerCase();
  if (minAge !== undefined) filters.min_age = minAge;
  if (maxAge !== undefined) filters.max_age = maxAge;
  if (minGP !== undefined) filters.min_gender_probability = minGP;
  if (minCP !== undefined) filters.min_country_probability = minCP;

  return { filters, sort: { sort_by, order }, pagination: { page: pageNum, limit: limitNum } };
}

/**
 * Format getProfiles result with the v1 pagination envelope.
 */
function paginationResponse(result) {
  return {
    status: 'success',
    data: result.data,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit),
    },
  };
}

// ── CSV export helpers ────────────────────────────────────────────────────────

const CSV_FIELDS = [
  'id', 'name', 'gender', 'gender_probability',
  'age', 'age_group', 'country_id', 'country_name', 'country_probability', 'created_at',
];

function escapeCsvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(rows) {
  const header = CSV_FIELDS.join(',');
  const lines = rows.map((row) =>
    CSV_FIELDS.map((f) => escapeCsvField(row[f])).join(',')
  );
  return [header, ...lines].join('\n');
}

// ── POST /api/v1/profiles ─────────────────────────────────────────────────────
router.post('/', requireRole('admin'), async (req, res, next) => {
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
      return res.status(201).json({ status: 'success', message: 'Profile already exists', data: existing });
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

// ── GET /api/v1/profiles/export (CSV) ────────────────────────────────────────
router.get('/export', (req, res, next) => {
  try {
    const parsed = parseProfilesQuery(req.query);
    if (!parsed) {
      return res.status(400).json({ status: 'error', message: 'Invalid query parameters' });
    }

    // For export we fetch up to 5000 rows (no pagination limit)
    parsed.pagination.limit = Math.min(
      parsed.pagination.limit === 10 ? 5000 : parsed.pagination.limit,
      5000
    );

    const result = getProfiles(parsed);
    const csv = toCSV(result.data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="profiles.csv"');
    return res.send(csv);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/profiles/search ───────────────────────────────────────────────
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

    return res.status(200).json(paginationResponse(result));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/profiles ──────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const parsed = parseProfilesQuery(req.query);
    if (!parsed) {
      return res.status(400).json({ status: 'error', message: 'Invalid query parameters' });
    }

    const result = getProfiles(parsed);
    return res.status(200).json(paginationResponse(result));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/profiles/:id ──────────────────────────────────────────────────
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

// ── DELETE /api/v1/profiles/:id ───────────────────────────────────────────────
router.delete('/:id', requireRole('admin'), (req, res, next) => {
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

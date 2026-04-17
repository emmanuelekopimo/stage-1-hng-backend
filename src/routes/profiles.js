const { Router } = require('express');
const {
  enrichProfile,
  createProfile,
  getProfileByName,
  getProfileById,
  getProfiles,
  deleteProfile,
} = require('../services/profiles');

const router = Router();

// POST /api/profiles
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;

    // Validate name
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

    // Check idempotency
    const existing = getProfileByName(trimmedName);
    if (existing) {
      return res.status(200).json({
        status: 'success',
        message: 'Profile already exists',
        data: existing,
      });
    }

    // Enrich and store
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

// GET /api/profiles
router.get('/', (req, res, next) => {
  try {
    const { gender, country_id, age_group } = req.query;
    const filters = {};
    if (gender) filters.gender = gender;
    if (country_id) filters.country_id = country_id;
    if (age_group) filters.age_group = age_group;

    const profiles = getProfiles(filters);

    return res.status(200).json({
      status: 'success',
      count: profiles.length,
      data: profiles,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/profiles/:id
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

// DELETE /api/profiles/:id
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

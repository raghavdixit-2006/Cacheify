'use strict';

/** Profile routes: the user's own saved data. */

const express = require('express');
const { validate, attachUser, rateLimit, requireAuth } = require('../../core/middleware');
const { ok } = require('../../core/envelope');
const service = require('./service');
const dataService = require('../data/service');
const { saveSchema } = require('./schema');

const router = express.Router();

const profileLimiter = rateLimit({ keyPrefix: 'profile' });

router.get(
  '/',
  attachUser,
  requireAuth,
  async (req, res, next) => {
    try {
      const profile = await service.getProfile(req.user);
      return ok(res, { profile });
    } catch (err) {
      return next(err);
    }
  },
);

router.put(
  '/',
  profileLimiter,
  attachUser,
  requireAuth,
  validate(saveSchema),
  async (req, res, next) => {
    try {
      const profile = await service.saveProfile(req.user, req.body, { requestId: req.requestId });
      return ok(res, { profile });
    } catch (err) {
      return next(err);
    }
  },
);

/* Command usage per day for the signed-in user (last 7 days). */
router.get(
  '/command-usage',
  attachUser,
  requireAuth,
  async (req, res, next) => {
    try {
      const usage = await dataService.getCommandUsage(req.user.id, 7);
      return ok(res, { usage });
    } catch (err) {
      return next(err);
    }
  },
);

module.exports = router;

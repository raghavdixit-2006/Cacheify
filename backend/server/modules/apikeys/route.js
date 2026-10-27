'use strict';

/** API keys routes: transport only. */

const express = require('express');
const { attachUser, requireAuth, rateLimit, validate } = require('../../core/middleware');
const { ok, created } = require('../../core/envelope');
const service = require('./service');
const { createSchema } = require('./schema');

const router = express.Router();

router.use(attachUser, requireAuth, rateLimit({ keyPrefix: 'api-keys' }));

router.get('/', async (req, res, next) => {
  try {
    return ok(res, { apiKeys: await service.listApiKeys(req.user.id) });
  } catch (err) {
    return next(err);
  }
});

router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    return created(res, await service.createApiKey(req.user, req.body, { requestId: req.requestId }));
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    return ok(res, await service.revokeApiKey(req.params.id, req.user, { requestId: req.requestId }));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

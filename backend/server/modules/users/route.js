'use strict';

/** Users routes (admin only): transport only. */

const express = require('express');
const { attachUser, requireAuth, requireAdmin, rateLimit, validate } = require('../../core/middleware');
const { ok } = require('../../core/envelope');
const service = require('./service');
const { listQuery, updateSchema } = require('./schema');

const router = express.Router();

router.use(attachUser, requireAuth, requireAdmin, rateLimit({ keyPrefix: 'admin-users' }));

router.get('/', validate(listQuery, 'query'), async (req, res, next) => {
  try {
    const page = await service.listUsers(req.validated.query);
    return ok(res, { users: page.users }, { cursor: page.meta.cursor });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    return ok(res, await service.getUser(req.params.id));
  } catch (err) {
    return next(err);
  }
});

router.patch('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    return ok(res, { user: await service.updateUser(req.params.id, req.body, req.user, { requestId: req.requestId }) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

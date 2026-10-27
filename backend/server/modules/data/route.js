'use strict';

/**
 * Data-plane routes: transport only for the Redis command API and the
 * REST convenience endpoints used by the UI. AuthN at edge, AuthZ + quotas
 * inside the service.
 */

const express = require('express');
const { attachUser, requireAuth, rateLimit, validate } = require('../../core/middleware');
const { ok, created } = require('../../core/envelope');
const service = require('./service');
const {
  commandSchema, pipelineSchema, stringPutSchema, expireSchema, listKeysQuery,
} = require('./schema');

const router = express.Router();

router.use(attachUser, requireAuth, rateLimit({ keyPrefix: 'data' }));

function handle(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/* Command console endpoint (single or pipeline). */
router.post('/:dbId/command', validate(commandSchema), handle(async (req, res) => {
  const result = await service.executeCommand(req.params.dbId, req.user, req.body.command, req.body.args);
  return ok(res, { result });
}));

router.post('/:dbId/pipeline', validate(pipelineSchema), handle(async (req, res) => {
  const results = await service.executePipeline(req.params.dbId, req.user, req.body.commands);
  return ok(res, { results });
}));

/* Key browsing + detail (used by the UI key table). */
router.get('/:dbId/keys', validate(listKeysQuery, 'query'), handle(async (req, res) => {
  const page = await service.browseKeys(req.params.dbId, req.user, req.validated.query);
  return ok(res, { keys: page.keys }, { cursor: page.meta.cursor });
}));

router.get('/:dbId/keys/:key', handle(async (req, res) => {
  return ok(res, { key: await service.getKeyDetail(req.params.dbId, req.user, req.params.key) });
}));

router.delete('/:dbId/keys/:key', handle(async (req, res) => {
  const deleted = await service.deleteKey(req.params.dbId, req.user, req.params.key);
  return ok(res, { deleted: Boolean(deleted) });
}));

/* String convenience endpoint (typed commands for forms/scripts). */
router.put('/:dbId/strings/:key', validate(stringPutSchema), handle(async (req, res) => {
  const result = await service.setString(req.params.dbId, req.user, req.params.key, req.body);
  return created(res, { result });
}));

/* TTL management. */
router.post('/:dbId/keys/:key/expire', validate(expireSchema), handle(async (req, res) => {
  const applied = await service.expireKey(req.params.dbId, req.user, req.params.key, req.body.expiresInMs);
  return ok(res, { applied: Boolean(applied) });
}));

router.delete('/:dbId/keys/:key/expire', handle(async (req, res) => {
  const applied = await service.persistKey(req.params.dbId, req.user, req.params.key);
  return ok(res, { applied: Boolean(applied) });
}));

module.exports = router;

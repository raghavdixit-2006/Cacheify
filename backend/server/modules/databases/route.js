'use strict';

/** Databases routes: transport only. */

const express = require('express');
const {
  attachUser, requireAuth, rateLimit, validate,
} = require('../../core/middleware');
const { ok, created } = require('../../core/envelope');
const service = require('./service');
const dataService = require('../data/service');
const apiKeyService = require('../apikeys/service');
const { createSchema: apiKeyCreateSchema } = require('../apikeys/schema');
const { createSchema, updateSchema } = require('./schema');

const router = express.Router();

router.use(attachUser, requireAuth, rateLimit({ keyPrefix: 'databases' }));

function handle(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.get('/', handle(async (req, res) => {
  const databases = await service.listDatabases(req.user);
  return ok(res, { databases });
}));

router.post('/', validate(createSchema), handle(async (req, res) => {
  const database = await service.createDatabase(req.user, req.body, { requestId: req.requestId });
  return created(res, { database });
}));

router.get('/:id', handle(async (req, res) => {
  return ok(res, { database: await service.getDatabase(req.params.id, req.user) });
}));

router.patch('/:id', validate(updateSchema), handle(async (req, res) => {
  return ok(res, { database: await service.updateDatabase(req.params.id, req.body, req.user, { requestId: req.requestId }) });
}));

router.delete('/:id', handle(async (req, res) => {
  return ok(res, await service.deleteDatabase(req.params.id, req.user, { requestId: req.requestId }));
}));

/* Danger zone: wipe all keys in this database, keeping the database itself. */
router.post('/:id/flush', handle(async (req, res) => {
  const result = await dataService.flushDatabase(req.params.id, req.user, { requestId: req.requestId });
  return ok(res, result);
}));

/* API key lifecycle inside the database context: exactly one active key. */
router.post('/:id/api-keys', validate(apiKeyCreateSchema.omit({ databaseId: true })), handle(async (req, res) => {
  const result = await apiKeyService.createApiKey(
    req.user,
    { name: req.body.name, databaseId: req.params.id, permission: req.body.permission },
    { requestId: req.requestId },
  );
  return created(res, result);
}));

router.get('/:id/api-key', handle(async (req, res) => {
  const apiKey = await apiKeyService.getDatabaseApiKey(req.params.id, req.user);
  return ok(res, { apiKey });
}));

module.exports = router;

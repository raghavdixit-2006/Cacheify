'use strict';

/** API keys module schemas. New keys are always scoped to one database. */

const { z } = require('zod');

const createSchema = z.strictObject({
  name: z.string().trim().min(1, 'Name is required').max(64),
  databaseId: z.string().trim().min(1, 'A database must be selected for the key'),
  permission: z.enum(['read-only', 'read-write']).optional().default('read-write'),
});

module.exports = { createSchema };

'use strict';

/** Databases module schemas. */

const { z } = require('zod');

const createSchema = z.strictObject({
  name: z.string().trim().min(1, 'Name is required').max(64),
  description: z.string().trim().max(500).optional().default(''),
});

const updateSchema = z.strictObject({
  name: z.string().trim().min(1).max(64).optional(),
  description: z.string().trim().max(500).optional(),
  status: z.enum(['active', 'archived']).optional(),
});

module.exports = { createSchema, updateSchema };

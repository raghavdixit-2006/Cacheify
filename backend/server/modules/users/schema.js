'use strict';

/** Users module schemas (admin control plane). */

const { z } = require('zod');

const listQuery = z.strictObject({
  cursor: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  q: z.string().trim().max(254).optional(),
});

const updateSchema = z.strictObject({
  status: z.enum(['active', 'suspended']).optional(),
  role: z.enum(['user', 'admin']).optional(),
  maxDatabases: z.number().int().min(1).max(1000).optional(),
  maxKeysPerDb: z.number().int().min(1).max(10_000_000).optional(),
  maxValueBytes: z.number().int().min(1).max(1_073_741_824).optional(),
});

module.exports = { listQuery, updateSchema };

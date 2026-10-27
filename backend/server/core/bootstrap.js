'use strict';

/** Bootstrap: seeds the admin account from injected env vars when provided. */

const bcrypt = require('bcryptjs');
const { config } = require('./env');
const store = require('./store');
const logger = require('./logger');

/** Seeds the control-plane admin into the MongoDB metadata store. */
async function seedAdmin() {
  if (!config.adminEmail || !config.adminPassword) return false;
  const users = await store.getUsers();
  const existing = await users.findOne({ email: config.adminEmail.toLowerCase() });
  if (existing) return false;
  const now = store.nowIso();
  const id = await store.nextId(store.collections.USERS);
  await users.insertOne({
    _id: id,
    public_id: store.newPublicId('usr'),
    email: config.adminEmail.toLowerCase(),
    password_hash: bcrypt.hashSync(config.adminPassword, config.bcryptCost),
    role: 'admin',
    status: 'active',
    email_verified: 1,
    max_databases: Math.max(config.defaultUserQuota.maxDatabases * 10, 50),
    max_keys_per_db: Math.max(config.defaultUserQuota.maxKeysPerDb * 10, 100_000),
    max_value_bytes: config.defaultUserQuota.maxValueBytes * 4,
    token_version: 0,
    created_at: now,
    updated_at: now,
  });
  logger.info('admin_seeded', { emailDomain: config.adminEmail.split('@')[1] || '' });
  return true;
}

module.exports = { seedAdmin };

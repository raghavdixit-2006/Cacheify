#!/usr/bin/env node
'use strict';

/** Seeds an admin user interactively or via CLI args (run inside your own terminal). */

const bcrypt = require('bcryptjs');
const readline = require('node:readline');
const store = require('../server/core/store');
const logger = require('../server/core/logger');

async function main() {
  let email = process.argv[2];
  let password = process.argv[3];

  if (!email || !password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    const ask = (q) => new Promise((resolve) => rl.question(q, resolve));
    email = await ask('Admin email: ');
    password = await ask('Admin password (min 8 chars): ');
    rl.close();
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('A valid email is required.');
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  // Admin bootstrap wiring is always lazy-loaded through the metadata store.
  const users = await store.getUsers();
  const existing = await users.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.error('A user with this email already exists.');
    process.exit(1);
  }

  const now = store.nowIso();
  const id = await store.nextId(store.collections.USERS);
  const { config } = require('../server/core/env');
  await users.insertOne({
    _id: id,
    public_id: store.newPublicId('usr'),
    email: email.toLowerCase(),
    password_hash: bcrypt.hashSync(password, 10),
    role: 'admin',
    status: 'active',
    email_verified: 1,
    max_databases: config.defaultUserQuota.maxDatabases * 10,
    max_keys_per_db: config.defaultUserQuota.maxKeysPerDb * 10,
    max_value_bytes: config.defaultUserQuota.maxValueBytes * 4,
    token_version: 0,
    created_at: now,
    updated_at: now,
  });

  logger.info('admin_created', { userId: id, store: 'mongodb' });
  console.log('Admin account created.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

'use strict';

/** Auth DAL: all user-credential storage. Metadata lives in MongoDB (store). */

const { config } = require('../../core/env');
const store = require('../../core/store');

function nowIso() {
  return store.nowIso();
}

/** Row projection matching the canonical users document shape for services/DTOs. */
const USER_ROW_PROJECTION = {
  projection: {
    _id: 1, public_id: 1, email: 1, role: 1, status: 1, email_verified: 1,
    max_databases: 1, max_keys_per_db: 1, max_value_bytes: 1, token_version: 1,
    created_at: 1, updated_at: 1, password_hash: 1,
  },
};

async function findByEmail(email) {
  const users = await store.getUsers();
  return store.rowize(await users.findOne(
    { email: { $regex: `^${escapeRegex(String(email).trim())}$`, $options: 'i' } },
    USER_ROW_PROJECTION,
  ));
}

async function findById(id) {
  const users = await store.getUsers();
  return store.rowize(await users.findOne({ _id: Number(id) }, USER_ROW_PROJECTION));
}

async function findByPublicId(publicIdValue) {
  const users = await store.getUsers();
  return store.rowize(await users.findOne({ public_id: publicIdValue }, USER_ROW_PROJECTION));
}

async function setEmailVerified(userId) {
  const users = await store.getUsers();
  await users.updateOne(
    { _id: Number(userId), email_verified: 0 },
    { $set: { email_verified: 1, updated_at: nowIso() } },
  );
  return findById(userId);
}

async function insertUser({ email, passwordHash, role = 'user', emailVerified = 1 }) {
  const nowValue = nowIso();
  const users = await store.getUsers();
  const id = await store.nextId(store.collections.USERS);
  await users.insertOne({
    _id: id,
    public_id: store.newPublicId('usr'),
    email: email.toLowerCase(),
    password_hash: passwordHash,
    role,
    status: 'active',
    email_verified: emailVerified,
    max_databases: config.defaultUserQuota.maxDatabases,
    max_keys_per_db: config.defaultUserQuota.maxKeysPerDb,
    max_value_bytes: config.defaultUserQuota.maxValueBytes,
    token_version: 0,
    created_at: nowValue,
    updated_at: nowValue,
  });
  return findById(id);
}

async function bumpTokenVersion(userId) {
  const users = await store.getUsers();
  await users.updateOne(
    { _id: Number(userId) },
    { $inc: { token_version: 1 }, $set: { updated_at: nowIso() } },
  );
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { findByEmail, findById, findByPublicId, setEmailVerified, insertUser, bumpTokenVersion };

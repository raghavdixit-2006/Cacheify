'use strict';

/** Users DAL (admin operations, MongoDB). Usage stats aggregate the shared
    redis_keys store; remote mode computes live usage off the Redis server. */

const { config } = require('../../core/env');
const store = require('../../core/store');
const keyStore = require('../data/key-store');
const databasesDal = require('../databases/dal');

const nowIso = () => store.nowIso();

const USER_ROW_PROJECTION = {
  projection: {
    _id: 1, public_id: 1, email: 1, role: 1, status: 1, email_verified: 1,
    max_databases: 1, max_keys_per_db: 1, max_value_bytes: 1, token_version: 1,
    created_at: 1, updated_at: 1,
  },
};

function escapeLike(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\%_]/g, '\\$&');
}

async function listPage({ cursor = 0, limit = 25, q = null }) {
  const users = await store.getUsers();
  const filter = { _id: { $gt: cursor } };
  if (q) filter.email = { $regex: escapeLike(q), $options: 'i' };
  const docs = await users.find(
    filter,
    { ...USER_ROW_PROJECTION, sort: { _id: 1 }, limit },
  ).toArray();
  return docs.map(store.rowize);
}

async function findByPublicId(publicIdValue) {
  const users = await store.getUsers();
  return store.rowize(await users.findOne(
    { public_id: publicIdValue },
    { ...USER_ROW_PROJECTION, projection: USER_ROW_PROJECTION.projection },
  ));
}

async function updateByPublicId(publicIdValue, patch) {
  const users = await store.getUsers();
  const row = await users.findOne({ public_id: publicIdValue }, USER_ROW_PROJECTION);
  if (!row) return null;
  const next = {
    role: patch.role ?? row.role,
    status: patch.status ?? row.status,
    maxDatabases: patch.maxDatabases ?? row.max_databases,
    maxKeysPerDb: patch.maxKeysPerDb ?? row.max_keys_per_db,
    maxValueBytes: patch.maxValueBytes ?? row.max_value_bytes,
  };
  // Changing role or suspending an account invalidates existing sessions.
  const rotateToken =
    (patch.role && patch.role !== row.role) ||
    (patch.status && patch.status !== row.status) ||
    (patch.status === 'suspended');
  const updated = await users.findOneAndUpdate(
    { _id: row._id },
    {
      $set: {
        role: next.role,
        status: next.status,
        max_databases: next.maxDatabases,
        max_keys_per_db: next.maxKeysPerDb,
        max_value_bytes: next.maxValueBytes,
        updated_at: nowIso(),
      },
      ...(rotateToken ? { $inc: { token_version: 1 } } : {}),
    },
    { returnDocument: 'after', projection: USER_ROW_PROJECTION.projection },
  );
  return store.rowize(updated);
}

/** Admin usage stats (databases + API keys, aggregate-only queries). */
async function baseStats(userRow) {
  const databases = await store.getDatabases();
  const keys = await store.getApiKeys();
  const byOwner = await databases.aggregate([
    { $match: { owner_user_id: userRow.id } },
    { $group: {
      _id: null,
      total: { $sum: 1 },
      active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
    } },
  ]).toArray();
  const apiKeyCount = await keys.countDocuments({ user_id: userRow.id, revoked_at: null });
  return {
    databases: { total: byOwner[0]?.total ?? 0, active: byOwner[0]?.active ?? 0 },
    apiKeys: { active: apiKeyCount },
  };
}

/** Local-engine usage: key data lives in the MongoDB redis_keys collection. */
async function embeddedKeyStats(userRow, databaseIds) {
  if (!databaseIds || databaseIds.length === 0) return { total: 0, bytes: 0 };
  return keyStore.usageStats(databaseIds);
}

module.exports = { listPage, findByPublicId, updateByPublicId, baseStats, embeddedKeyStats };

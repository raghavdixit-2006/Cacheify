'use strict';

/**
 * Metadata store (core): MongoDB-backed platform storage.
 *
 * ALL platform data — users, session principals, database registry, API keys,
 * audit trail, and tenant key data (redis_keys) — lives in MongoDB Atlas.
 * Documents use snake_case columns with integer ids from a `counters`
 * collection, so services and DTO projections keep their contracts.
 * Every query is parameterized; the Mongo driver has no injection surface
 * beyond field names, which are code-owned.
 */

const { config } = require('./env');
const { publicId } = require('./crypto');
const mongo = require('../modules/integrations/mongo');

const USERS = 'users';
const DATABASES = 'redis_databases';
const API_KEYS = 'api_keys';
const AUDIT_LOGS = 'audit_logs';
const COUNTERS = 'counters';
const REDIS_KEYS = 'redis_keys';
const COMMAND_USAGES = 'command_usage';

let bootPromise = null;

/** Idempotent index bootstrap; runs once per process before first use. */
function boot() {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const db = await mongo.db();
    await db.collection(USERS).createIndexes([
      { key: { email: 1 }, name: 'idx_users_email_unique', unique: true, collation: { locale: 'en', strength: 2 } },
      { key: { public_id: 1 }, name: 'idx_users_public_id', unique: true },
    ]);
    await db.collection(DATABASES).createIndexes([
      { key: { public_id: 1 }, name: 'idx_rdb_public_id', unique: true },
      { key: { namespace: 1 }, name: 'idx_rdb_namespace', unique: true },
      { key: { owner_user_id: 1, status: 1 }, name: 'idx_rdb_owner' },
      { key: { owner_user_id: 1, name: 1 }, name: 'idx_rdb_owner_name' },
    ]);
    await db.collection(API_KEYS).createIndexes([
      { key: { key_hash: 1 }, name: 'idx_api_keys_hash', unique: true },
      { key: { public_id: 1 }, name: 'idx_api_keys_public_id', unique: true },
      { key: { user_id: 1 }, name: 'idx_api_keys_user' },
      { key: { database_id: 1 }, name: 'idx_api_keys_database' },
    ]);
    await db.collection(AUDIT_LOGS).createIndexes([
      { key: { actor_user_id: 1, created_at: -1 }, name: 'idx_audit_actor' },
    ]);
    await db.collection(REDIS_KEYS).createIndexes([
      { key: { database_id: 1, name: 1 }, name: 'idx_rk_database_name', unique: true },
      { key: { database_id: 1, expires_at: 1 }, name: 'idx_rk_expiry' },
    ]);
    await db.collection(COMMAND_USAGES).createIndexes([
      { key: { user_id: 1, date: 1 }, name: 'idx_cu_user_date' },
      { key: { user_id: 1, date: 1, command: 1 }, name: 'idx_cu_user_date_command' },
    ]);
  })().catch((err) => {
    bootPromise = null;
    throw err;
  });
  return bootPromise;
}

async function collection(name) {
  await boot();
  return (await mongo.db()).collection(name);
}

/** Post-process documents into former-SQL-row shape (numeric `id` column). */
function rowize(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

const nowIso = () => new Date().toISOString();

/** Monotonic integer ids per collection (matches the AUTOINCREMENT contract). */
async function nextId(name) {
  const db = await mongo.db();
  const doc = await db.collection(COUNTERS).findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return doc.seq;
}

/** Ensure the counter row is at or beyond an explicit seed id (admin bootstrap). */
async function syncCounter(name, seedId) {
  const db = await mongo.db();
  await db.collection(COUNTERS).updateOne(
    { _id: name, seq: { $lt: seedId } },
    { $set: { seq: seedId } },
  );
}

module.exports = {
  boot,
  rowize,
  nowIso,
  nextId,
  syncCounter,
  collections: { USERS, DATABASES, API_KEYS, AUDIT_LOGS, COUNTERS, REDIS_KEYS, COMMAND_USAGES },
  getUsers: () => collection(USERS),
  getDatabases: () => collection(DATABASES),
  getApiKeys: () => collection(API_KEYS),
  getAuditLogs: () => collection(AUDIT_LOGS),
  getKeys: () => collection(REDIS_KEYS),
  getCommandUsages: () => collection(COMMAND_USAGES),
  /** Convenience for identity-bearing inserts: { public_id, keyMaterial } pair. */
  newPublicId: publicId,
};

'use strict';

/**
 * Key store (data module): the platform's tenant key data lives in MongoDB
 * (`redis_keys` collection), the same Atlas store as the control plane.
 *
 * Document shape (per tenant key):
 *   { _id, database_id, name, type, value(JSON string), expires_at(ms|null),
 *     created_at, updated_at }
 *
 * Mandatory-expiry policy lives in writeValue(): a write that would leave a
 * key without a TTL receives the platform default expiry, so no key is immortal.
 */

const { config } = require('../../core/env');
const store = require('../../core/store');

const KEYS = store.collections.REDIS_KEYS;

const nowIso = () => store.nowIso();

function get() {
  return store.getKeys();
}

/** Mongo document -> former key-row shape ({ _id ... id } shadow of old rows). */
function rowize(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

async function liveRow(databaseId, key) {
  const keys = await get();
  const doc = await keys.findOne({ database_id: databaseId, name: key });
  if (!doc) return null;
  if (doc.expires_at !== null && doc.expires_at <= Date.now()) {
    await keys.deleteOne({ _id: doc._id });
    return null;
  }
  return rowize(doc);
}

/** Upsert a key row. `expiresAtMs == null` stamps the platform default TTL.
    `valueJson` may be a JSON string (engine path) or a plain value (defensive). */
async function writeValue(databaseId, key, keyType, valueJson, expiresAtMs, timestampMs) {
  const keys = await get();
  /* Mandatory-expiry policy: a write that would leave the key without a TTL
     receives the platform default expiry, so no key is ever immortal. */
  const effectiveExpiry = expiresAtMs != null
    ? expiresAtMs
    : timestampMs + config.defaultKeyTtlMs;
  const valueSerialized = typeof valueJson === 'string' ? valueJson : JSON.stringify(valueJson);
  await keys.updateOne(
    { database_id: databaseId, name: key },
    {
      $set: {
        type: keyType,
        value: valueSerialized,
        expires_at: effectiveExpiry,
        updated_at: new Date(timestampMs).toISOString(),
      },
      $setOnInsert: {
        database_id: databaseId,
        name: key,
        created_at: new Date(timestampMs).toISOString(),
      },
    },
    { upsert: true },
  );
}

async function deleteById(databaseId, id) {
  const keys = await get();
  await keys.deleteOne({ database_id: databaseId, _id: id });
}

async function deleteByDatabase(databaseId) {
  const keys = await get();
  await keys.deleteMany({ database_id: databaseId });
}

async function deleteByName(databaseId, name) {
  const keys = await get();
  const result = await keys.deleteOne({ database_id: databaseId, name });
  return result.deletedCount;
}

/** Count of unexpired keys for one logical database (quota accounting). */
async function countLiveKeys(databaseId) {
  const keys = await get();
  return keys.countDocuments({
    database_id: databaseId,
    $or: [{ expires_at: null }, { expires_at: { $gt: Date.now() } }],
  });
}

/** The subset of `names` that currently exist with live TTLs. */
async function existingNames(databaseId, names) {
  if (names.length === 0) return new Set();
  const keys = await get();
  const docs = await keys.find(
    {
      database_id: databaseId,
      name: { $in: names },
      $or: [{ expires_at: null }, { expires_at: { $gt: Date.now() } }],
    },
    { projection: { name: 1 } },
  ).toArray();
  return new Set(docs.map((doc) => doc.name));
}

/** Stored serialized bytes of one key (0 when missing). */
async function valueBytes(databaseId, name) {
  const row = await liveRow(databaseId, name);
  return row && typeof row.value === 'string' ? Buffer.byteLength(row.value, 'utf8') : 0;
}

/**
 * Snapshot the full rows of named keys (before a write batch) so a quota or
 * domain failure can restore the exact prior state — the atomicity guarantee
 * the retired transactional engine provided.
 */
async function snapshotKeys(databaseId, names) {
  const keys = await get();
  const docs = names.length === 0
    ? []
    : await keys.find({ database_id: databaseId, name: { $in: names } }).toArray();
  const map = new Map();
  for (const doc of docs) map.set(doc.name, { ...doc });
  return map;
}

/** Restore a snapshot: re-pin prior versions, remove keys created after it. */
async function restoreSnapshot(map) {
  if (map.size === 0) return;
  const keys = await get();
  const existing = await keys.find(
    { database_id: Object.values(map)[0]?.database_id, name: { $in: [...map.keys()] } },
    { projection: { _id: 1, name: 1 } },
  ).toArray();
  const byName = new Map(existing.map((doc) => [doc.name, doc]));
  const operations = [];
  for (const [name, prior] of map.entries()) {
    const current = byName.get(name);
    if (!current) {
      if (prior) {
        operations.push({
          replaceOne: { filter: { _id: prior._id }, replacement: prior },
        });
      }
      continue;
    }
    if (prior) operations.push({ replaceOne: { filter: { _id: current._id }, replacement: { ...prior, _id: current._id } } });
    else operations.push({ deleteOne: { filter: { _id: current._id } } });
  }
  if (operations.length > 0) await keys.bulkWrite(operations, { ordered: false });
}

/** Paginate live rows of one database after an ObjectId cursor (key browsing). */
async function rowsPage(databaseId, { afterId, limit }) {
  const keys = await get();
  const filter = { database_id: databaseId };
  if (afterId) filter._id = { $gt: afterId };
  const docs = await keys.find(filter, { sort: { _id: 1 }, limit: limit + 1 }).toArray();
  return {
    rows: docs.slice(0, limit).map(rowize),
    hasMore: docs.length > limit,
    lastId: docs.length > 0 ? docs[Math.min(docs.length, limit) - 1]._id : null,
  };
}

/** All live key names of one database, ordered by name (KEYS/SCAN support). */
async function liveNames(databaseId) {
  const keys = await get();
  const docs = await keys.find(
    { database_id: databaseId },
    { projection: { name: 1, expires_at: 1 }, sort: { name: 1 } },
  ).toArray();
  const nowValue = Date.now();
  const live = [];
  let tombstones = 0;
  for (const doc of docs) {
    if (doc.expires_at !== null && doc.expires_at <= nowValue) {
      await keys.deleteOne({ _id: doc._id });
      tombstones += 1;
      continue;
    }
    live.push(doc.name);
  }
  return { names: live, tombstones };
}

/** Kept-value count + stored bytes per type (usage/stat plumbing). */
async function statsByType(databaseId) {
  const keys = await get();
  const rows = await keys.aggregate([
    { $match: { database_id: databaseId, $or: [{ expires_at: null }, { expires_at: { $gt: Date.now() } }] } },
    { $group: { _id: '$type', n: { $sum: 1 }, bytes: { $sum: { $binarySize: '$value' } } } },
  ]).toArray();
  const expiring = await keys.countDocuments({
    database_id: databaseId,
    expires_at: { $gt: Date.now() },
  });
  return { byTypeRows: rows.map((row) => ({ type: row._id, n: row.n, bytes: row.bytes })), expiringKeys: expiring };
}

/** Aggregate (count + stored bytes) across a set of databases (admin usage). */
async function usageStats(databaseIds) {
  if (databaseIds.length === 0) return { total: 0, bytes: 0 };
  const keys = await get();
  const rows = await keys.aggregate([
    { $match: { database_id: { $in: databaseIds } } },
    { $group: {
      n: { $sum: 1 },
      bytes: { $sum: { $binarySize: '$value' } },
    } },
  ]).toArray();
  return { total: rows[0]?.n ?? 0, bytes: rows[0]?.bytes ?? 0 };
}

/** Maintenance: remove all expired keys of one database (or globally). */
async function sweepExpired(databaseId) {
  const keys = await get();
  const result = await keys.deleteMany({
    database_id: databaseId,
    expires_at: { $ne: null, $lte: Date.now() },
  });
  return result.deletedCount;
}

async function sweepAllExpired() {
  const keys = await get();
  const result = await keys.deleteMany({
    expires_at: { $ne: null, $lte: Date.now() },
  });
  return result.deletedCount;
}

module.exports = {
  liveRow,
  writeValue,
  deleteById,
  deleteByDatabase,
  deleteByName,
  countLiveKeys,
  existingNames,
  valueBytes,
  snapshotKeys,
  restoreSnapshot,
  rowsPage,
  liveNames,
  statsByType,
  usageStats,
  sweepExpired,
  sweepAllExpired,
};

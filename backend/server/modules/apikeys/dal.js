'use strict';

/** API keys DAL (MongoDB). Plaintext keys are never persisted — hash lookups only. */

const store = require('../../core/store');
const { generateApiKey, hashApiKey } = require('../../core/crypto');

const nowIso = () => store.nowIso();

const KEY_ROW_PROJECTION = {
  projection: {
    _id: 1, public_id: 1, user_id: 1, name: 1, key_hash: 1, prefix: 1,
    database_id: 1, permission: 1, last_used_at: 1, revoked_at: 1,
    created_at: 1, updated_at: 1,
  },
};

async function insert(userId, { name, databaseId, permission }, plaintext = null) {
  const generated = plaintext ? null : generateApiKey();
  const keyMaterial = plaintext || generated.plaintext;
  const keys = await store.getApiKeys();
  const id = await store.nextId(store.collections.API_KEYS);
  await keys.insertOne({
    _id: id,
    public_id: store.newPublicId('key'),
    user_id: userId,
    name,
    key_hash: hashApiKey(keyMaterial),
    prefix: keyMaterial.slice(0, 8),
    database_id: databaseId ?? null,
    permission: permission || 'read-write',
    last_used_at: null,
    revoked_at: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  });
  const row = await findByInternalId(id);
  return { row, plaintext: keyMaterial };
}

async function findByInternalId(id) {
  const keys = await store.getApiKeys();
  return store.rowize(await keys.findOne({ _id: Number(id) }, KEY_ROW_PROJECTION));
}

/** Keys + their scope columns (replaces the SQL JOIN with a $lookup). */
async function listByUser(userId) {
  const keys = await store.getApiKeys();
  const docs = await keys.aggregate([
    { $match: { user_id: userId } },
    { $lookup: {
      from: store.collections.DATABASES,
      localField: 'database_id',
      foreignField: '_id',
      as: 'db',
    } },
    { $unwind: { path: '$db', preserveNullAndEmptyArrays: true } },
    { $project: {
      _id: 1, public_id: 1, user_id: 1, name: 1, key_hash: 1, prefix: 1,
      database_id: 1, permission: 1, last_used_at: 1, revoked_at: 1,
      created_at: 1, updated_at: 1,
      database_public_id: '$db.public_id',
      database_name: '$db.name',
    } },
    { $sort: { created_at: -1, _id: -1 } },
  ]).toArray();
  return docs.map(store.rowize);
}

async function findByDatabasePublicId(databasePublicId, userId) {
  const databases = await store.getDatabases();
  return store.rowize(await databases.findOne({
    public_id: databasePublicId,
    owner_user_id: userId,
  }, {
    projection: { _id: 1, public_id: 1, owner_user_id: 1, name: 1, namespace: 1, status: 1 },
  }));
}

async function findByPublicId(publicIdValue) {
  const keys = await store.getApiKeys();
  return store.rowize(await keys.findOne({ public_id: publicIdValue }, KEY_ROW_PROJECTION));
}

/** The single active (non-revoked) key for a database, by internal id. */
async function activeByDatabaseId(databaseId) {
  const keys = await store.getApiKeys();
  const doc = await keys.findOne(
    { database_id: databaseId, revoked_at: null },
    { ...KEY_ROW_PROJECTION, sort: { created_at: -1, _id: -1 } },
  );
  return store.rowize(doc);
}

/** Active key for a database, ownership-checked via the scope join. */
async function findActiveScopedByDatabase(databasePublicId, userId) {
  const keys = await store.getApiKeys();
  const doc = await keys.aggregate([
    { $match: { revoked_at: null } },
    { $lookup: {
      from: store.collections.DATABASES,
      localField: 'database_id',
      foreignField: '_id',
      as: 'rdb',
    } },
    { $unwind: '$rdb' },
    { $match: {
      'rdb.public_id': databasePublicId,
      'rdb.owner_user_id': userId,
    } },
    { $project: {
      _id: 1, public_id: 1, user_id: 1, name: 1, key_hash: 1, prefix: 1,
      database_id: 1, permission: 1, last_used_at: 1, revoked_at: 1,
      created_at: 1, updated_at: 1,
      database_public_id: '$rdb.public_id',
      database_name: '$rdb.name',
    } },
    { $sort: { created_at: -1, _id: -1 } },
    { $limit: 1 },
  ]).toArray();
  return doc.length ? store.rowize(doc[0]) : null;
}

async function findByPublicIdForUser(publicIdValue, userId) {
  const keys = await store.getApiKeys();
  return store.rowize(await keys.findOne(
    { public_id: publicIdValue, user_id: userId },
    KEY_ROW_PROJECTION,
  ));
}

async function revoke(publicIdValue) {
  const keys = await store.getApiKeys();
  const result = await keys.updateMany(
    { public_id: publicIdValue, revoked_at: null },
    { $set: { revoked_at: nowIso(), updated_at: nowIso() } },
  );
  return result.modifiedCount;
}

module.exports = {
  insert,
  listByUser,
  findByDatabasePublicId,
  findByPublicId,
  findByPublicIdForUser,
  activeByDatabaseId,
  findActiveScopedByDatabase,
  revoke,
};

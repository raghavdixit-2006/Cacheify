'use strict';

/** Databases DAL: redis_databases metadata (MongoDB). Key aggregates for the
    local engine live in the shared redis_keys collection (data/key-store). */

const store = require('../../core/store');

const nowIso = () => store.nowIso();

const DB_ROW_PROJECTION = {
  projection: {
    _id: 1, public_id: 1, owner_user_id: 1, name: 1, description: 1,
    status: 1, namespace: 1, created_at: 1, updated_at: 1,
  },
};

async function findByPublicId(publicIdValue) {
  const databases = await store.getDatabases();
  return store.rowize(await databases.findOne({ public_id: publicIdValue }, DB_ROW_PROJECTION));
}

async function findByPublicIdForOwner(publicIdValue, ownerUserId) {
  const databases = await store.getDatabases();
  return store.rowize(await databases.findOne({
    public_id: publicIdValue,
    owner_user_id: ownerUserId,
  }, DB_ROW_PROJECTION));
}

async function listByOwner(ownerUserId) {
  const databases = await store.getDatabases();
  const docs = await databases.find(
    { owner_user_id: ownerUserId },
    { ...DB_ROW_PROJECTION, sort: { created_at: -1, _id: -1 } },
  ).toArray();
  return docs.map(store.rowize);
}

async function listAll() {
  const databases = await store.getDatabases();
  const docs = await databases.find({}, { ...DB_ROW_PROJECTION, sort: { created_at: -1, _id: -1 } }).toArray();
  return docs.map(store.rowize);
}

async function countByOwner(ownerUserId) {
  const databases = await store.getDatabases();
  return databases.countDocuments({ owner_user_id: ownerUserId, status: 'active' });
}

/** Duplicate-name check for the active namespace of one owner. */
async function hasActiveWithName(ownerUserId, name) {
  const databases = await store.getDatabases();
  return (await databases.countDocuments({ owner_user_id: ownerUserId, name, status: 'active' })) > 0;
}

async function hasOtherWithName(ownerUserId, name, excludePublicId) {
  const databases = await store.getDatabases();
  return (await databases.countDocuments({
    owner_user_id: ownerUserId,
    name,
    public_id: { $ne: excludePublicId },
  })) > 0;
}

async function insert({ ownerUserId, name, description, namespace }) {
  const now = nowIso();
  const databases = await store.getDatabases();
  const id = await store.nextId(store.collections.DATABASES);
  await databases.insertOne({
    _id: id,
    public_id: store.newPublicId('rdb'),
    owner_user_id: ownerUserId,
    name,
    description,
    status: 'active',
    namespace,
    created_at: now,
    updated_at: now,
  });
  return store.rowize(await databases.findOne({ _id: id }, DB_ROW_PROJECTION));
}

async function update(publicIdValue, patch) {
  const databases = await store.getDatabases();
  const row = await databases.findOne({ public_id: publicIdValue });
  if (!row) return null;
  await databases.updateOne(
    { _id: row._id },
    {
      $set: {
        name: patch.name ?? row.name,
        description: patch.description ?? row.description,
        status: patch.status ?? row.status,
        updated_at: nowIso(),
      },
    },
  );
  return store.rowize(await databases.findOne({ _id: row._id }, DB_ROW_PROJECTION));
}

/** Delete the metadata row; the caller handles key-data cleanup per backend. */
async function deleteRow(publicIdValue) {
  const databases = await store.getDatabases();
  const row = await databases.findOne({ public_id: publicIdValue });
  if (!row) return 0;
  await databases.deleteOne({ _id: row._id });
  return 1;
}

async function updateById(id, patch) {
  const databases = await store.getDatabases();
  return store.rowize(await databases.findOneAndUpdate(
    { _id: Number(id) },
    { $set: { ...patch, updated_at: nowIso() } },
    { returnDocument: 'after', projection: DB_ROW_PROJECTION.projection },
  ));
}

module.exports = {
  findByPublicId,
  findByPublicIdForOwner,
  listByOwner,
  listAll,
  countByOwner,
  hasActiveWithName,
  hasOtherWithName,
  insert,
  update,
  deleteRow,
  updateById,
  getInternalIdByPublicId: async (publicIdValue) => {
    const row = await findByPublicId(publicIdValue);
    return row ? row.id : null;
  },
};

'use strict';

/** DTO projections (core): map DB rows to sanitized public shapes. Never leak internals. */

function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.public_id,
    email: row.email,
    role: row.role,
    status: row.status,
    emailVerified: row.email_verified === undefined ? true : row.email_verified === 1,
    quota: {
      maxDatabases: row.max_databases,
      maxKeysPerDb: row.max_keys_per_db,
      maxValueBytes: row.max_value_bytes,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPublicDatabase(row, stats) {
  if (!row) return null;
  return {
    id: row.public_id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(stats ? { stats } : {}),
  };
}

function toPublicApiKey(row) {
  if (!row) return null;
  return {
    id: row.public_id,
    name: row.name,
    prefix: row.prefix,
    // Scope: null database = legacy unscoped key (all databases, read-write).
    database: row.database_public_id || row.databaseName || row.database_id
      ? { id: row.database_public_id || null, name: row.database_name || null }
      : null,
    permission: row.permission || 'read-write',
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

function toPublicKey(keyRow) {
  if (!keyRow) return null;
  return {
    name: keyRow.name,
    type: keyRow.type,
    expiresAt: keyRow.expires_at === null ? null : new Date(keyRow.expires_at).toISOString(),
    createdAt: keyRow.created_at,
    updatedAt: keyRow.updated_at,
  };
}

module.exports = { toPublicUser, toPublicDatabase, toPublicApiKey, toPublicKey };

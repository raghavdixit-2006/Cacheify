/** API key service wrappers (+ admin users). */

import { api } from './api.js';

export function listApiKeys() {
  return api.get('/api/api-keys');
}

export function createApiKey({ name, databaseId, permission }) {
  return api.post('/api/api-keys', { name, databaseId, permission });
}

export function revokeApiKey(id) {
  return api.delete(`/api/api-keys/${id}`);
}

/* Database-scoped key lifecycle: exactly one active key per database. */
export function getDatabaseApiKey(dbId) {
  return api.get(`/api/databases/${dbId}/api-key`);
}

export function createDatabaseApiKey(dbId, { name, permission }) {
  return api.post(`/api/databases/${dbId}/api-keys`, { name, permission });
}

/* Admin */
export function listUsers({ cursor = 0, limit = 25, q = undefined } = {}) {
  return api.get('/api/users', { cursor, limit, q });
}

export function getUser(id) {
  return api.get(`/api/users/${id}`);
}

export function updateUser(id, patch) {
  return api.patch(`/api/users/${id}`, patch);
}

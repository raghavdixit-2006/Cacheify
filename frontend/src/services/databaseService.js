/** Databases + data-plane service wrappers. */

import { api } from './api.js';

export function listDatabases() {
  return api.get('/api/databases');
}

export function createDatabase({ name, description }) {
  return api.post('/api/databases', { name, description });
}

export function getDatabase(id) {
  return api.get(`/api/databases/${id}`);
}

export function updateDatabase(id, patch) {
  return api.patch(`/api/databases/${id}`, patch);
}

export function deleteDatabase(id) {
  return api.delete(`/api/databases/${id}`);
}

export function flushDatabase(id) {
  return api.post(`/api/databases/${id}/flush`, {});
}

/** Data plane: keys and typed commands. */
export function listKeys(dbId, { pattern = '', cursor = 0, limit = 25 } = {}) {
  return api.get(`/api/data/${dbId}/keys`, { pattern, cursor, limit });
}

export function getKey(dbId, key) {
  return api.get(`/api/data/${dbId}/keys/${encodeURIComponent(key)}`);
}

export function deleteKey(dbId, key) {
  return api.delete(`/api/data/${dbId}/keys/${encodeURIComponent(key)}`);
}

export function runCommand(dbId, command, args) {
  return api.post(`/api/data/${dbId}/command`, { command, args });
}

export function runPipeline(dbId, commands) {
  return api.post(`/api/data/${dbId}/pipeline`, { commands });
}

export function setString(dbId, key, { value, expiresInMs } = {}) {
  return api.put(`/api/data/${dbId}/strings/${encodeURIComponent(key)}`, { value, expiresInMs });
}

export function expireKey(dbId, key, expiresInMs) {
  return api.post(`/api/data/${dbId}/keys/${encodeURIComponent(key)}/expire`, { expiresInMs });
}

export function persistKey(dbId, key) {
  return api.delete(`/api/data/${dbId}/keys/${encodeURIComponent(key)}/expire`);
}

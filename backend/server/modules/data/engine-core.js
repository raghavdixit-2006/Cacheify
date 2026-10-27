'use strict';

/**
 * Key-row primitives (data module) over the MongoDB key store.
 *
 * Terminology (layer discipline):
 *   dbId        = the tenant logical database id (registry row id)
 *   keyRow      = rowized redis_keys document
 *
 * TTL semantics match Redis (expired keys read as missing; TTL is -1 when no
 * expiry, -2 when missing).
 */

const { config } = require('../../core/env');
const keyStore = require('./key-store');

/* ------------------------------ Type helpers ------------------------------ */

const TYPES = new Set(['string', 'list', 'set', 'hash', 'zset']);

function wrongType() {
  const err = new Error('WRONGTYPE Operation against a key holding the wrong kind of value');
  err.redis = true;
  throw err;
}

function expectType(row, type) {
  if (row && row.type !== type) wrongType();
  return row;
}

function encode(keyType, value) {
  if (keyType === 'string') return { v: value };
  if (keyType === 'list') return { v: value };
  if (keyType === 'set') return { v: value }; // Set -> JSON as array
  if (keyType === 'hash') return { v: value };
  if (keyType === 'zset') return { v: { seq: value.seq, entries: value.entries } };
  throw new Error(`engine: unsupported type ${keyType}`);
}

function decode(keyType, stored) {
  if (keyType === 'set') return new Set(stored.v);
  if (keyType === 'zset') return { seq: stored.v.seq, entries: stored.v.entries };
  return stored.v;
}

/* ------------------------------ Row primitives ---------------------------- */

const liveRow = (dbId, key) => keyStore.liveRow(dbId, key);

/** Writes go through the store, which enforces the mandatory-expiry policy. */
function writeValue(dbId, key, keyType, value, expiresAtMs, timestampMs) {
  const valueJson = JSON.stringify(encode(keyType, value));
  return keyStore.writeValue(dbId, key, keyType, valueJson, expiresAtMs, timestampMs);
}

/* --------------------------------- Numbers -------------------------------- */

function toInt(value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(n)) {
    const err = new Error('ERR value is not an integer or out of range');
    err.redis = true;
    throw err;
  }
  return n;
}

async function incrementString(dbId, key, delta, nowMs) {
  const row = await keyStore.liveRow(dbId, key);
  let current = 0;
  if (row) {
    expectType(row, 'string');
    const value = JSON.parse(row.value).v;
    current = Number(value);
    if (!Number.isInteger(current)) {
      const err = new Error('ERR value is not an integer');
      err.redis = true;
      throw err;
    }
  }
  const next = current + delta;
  if (!Number.isSafeInteger(next)) {
    const err = new Error('ERR increment or decrement would overflow');
    err.redis = true;
    throw err;
  }
  const existingExpiry = row ? row.expires_at : null;
  await writeValue(dbId, key, 'string', String(next), existingExpiry, nowMs);
  return next;
}

/* ---------------------------------- Sets ---------------------------------- */

async function loadSet(dbId, key, nowMs) {
  const row = await keyStore.liveRow(dbId, key);
  expectType(row, 'set');
  return row ? { row, set: new Set(JSON.parse(row.value).v) } : null;
}

function saveSet(dbId, key, set, existingRow, nowMs) {
  return writeValue(
    dbId,
    key,
    'set',
    [...set],
    existingRow ? existingRow.expires_at : null,
    nowMs,
  );
}

/* ---------------------------------- ZSet ---------------------------------- */

async function loadZSet(dbId, key, nowMs) {
  const row = await keyStore.liveRow(dbId, key);
  expectType(row, 'zset');
  if (!row) return null;
  const parsed = JSON.parse(row.value).v;
  return { row, seq: parsed.seq, entries: parsed.entries };
}

function saveZSet(dbId, key, state, existingRow, nowMs) {
  return writeValue(
    dbId,
    key,
    'zset',
    { seq: state.seq, entries: state.entries },
    existingRow ? existingRow.expires_at : null,
    nowMs,
  );
}

/* --------------------------- Glob pattern matching ------------------------ */

// Redis-style glob: * ? [abc] [^abc]. Escapes via backslash are not supported
// in Redis key patterns, matching upstream behavior.
function globToRegExp(pattern) {
  let out = '^';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') out += '[\\s\\S]*';
    else if (ch === '?') out += '[\\s\\S]';
    else if (ch === '[') {
      let j = i + 1;
      let negate = false;
      if (j < pattern.length && (pattern[j] === '^' || pattern[j] === '!')) {
        negate = true;
        j += 1;
      }
      let body = '';
      // tolerate an immediate ] as a literal member
      if (j < pattern.length && pattern[j] === ']') { body += ']'; j += 1; }
      while (j < pattern.length && pattern[j] !== ']') {
        body += pattern[j].replace(/[\\\]]/g, '\\$&');
        j += 1;
      }
      if (j >= pattern.length) return new RegExp('^' + pattern.replace(/[*?[\]]/g, '\\$&') + '$');
      out += `[${negate ? '^' : ''}${body}]`;
      i = j;
      continue;
    } else if (ch === '\\') {
      if (i + 1 < pattern.length) out += pattern[i + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i += 2;
      continue;
    } else {
      out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    i += 1;
  }
  return new RegExp(out + '$');
}

/* --------------------------------- Sweep ---------------------------------- */

const sweepExpired = (dbId) => keyStore.sweepExpired(dbId);
const sweepAllExpired = () => keyStore.sweepAllExpired();

module.exports = {
  TYPES,
  wrongType,
  expectType,
  encode,
  decode,
  liveRow,
  writeValue,
  toInt,
  incrementString,
  loadSet,
  saveSet,
  loadZSet,
  saveZSet,
  globToRegExp,
  sweepExpired,
  sweepAllExpired,
};

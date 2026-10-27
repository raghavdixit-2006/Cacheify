'use strict';

/**
 * Engine facade: command registry, argument validation, and execution.
 * Services call executeDatabaseCommand / executeDatabasePipeline only.
 * Execution targets the MongoDB key store (async); quota/atomicity
 * snapshotting lives in data/service.js.
 */

const { strings, keyCommands, lists, sets, hashes, zsets } = require('./engine-commands');
const keyStore = require('./key-store');

class EngineError extends Error {
  constructor(message, code = 'ERR_REDIS') {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}

/* Command registry: name -> { run, minArgs, group }. Max args capped at 256. */
const COMMANDS = new Map([
  // strings
  ['GET', { run: strings.get, minArgs: 1, maxArgs: 1, group: 'string' }],
  ['SET', { run: strings.set, minArgs: 2, maxArgs: 8, group: 'string' }],
  ['SETEX', { run: strings.setex, minArgs: 3, maxArgs: 3, group: 'string' }],
  ['PSETEX', { run: strings.psetex, minArgs: 3, maxArgs: 3, group: 'string' }],
  ['MGET', { run: strings.mget, minArgs: 1, maxArgs: 256, group: 'string' }],
  ['MSET', { run: strings.mset, minArgs: 2, maxArgs: 256, group: 'string' }],
  ['INCR', { run: strings.incr, minArgs: 1, maxArgs: 1, group: 'string' }],
  ['DECR', { run: strings.decr, minArgs: 1, maxArgs: 1, group: 'string' }],
  ['INCRBY', { run: strings.incrby, minArgs: 2, maxArgs: 2, group: 'string' }],
  ['DECRBY', { run: strings.decrby, minArgs: 2, maxArgs: 2, group: 'string' }],
  ['APPEND', { run: strings.append, minArgs: 2, maxArgs: 2, group: 'string' }],
  ['STRLEN', { run: strings.strlen, minArgs: 1, maxArgs: 1, group: 'string' }],
  ['GETRANGE', { run: strings.getrange, minArgs: 3, maxArgs: 3, group: 'string' }],
  // keys
  ['EXISTS', { run: keyCommands.exists, minArgs: 1, maxArgs: 256, group: 'key' }],
  ['DEL', { run: keyCommands.del, minArgs: 1, maxArgs: 256, group: 'key' }],
  ['TYPE', { run: keyCommands.type, minArgs: 1, maxArgs: 1, group: 'key' }],
  ['KEYS', { run: keyCommands.keys, minArgs: 1, maxArgs: 1, group: 'key' }],
  ['SCAN', { run: keyCommands.scan, minArgs: 1, maxArgs: 5, group: 'key' }],
  ['EXPIRE', { run: keyCommands.expire, minArgs: 2, maxArgs: 2, group: 'key' }],
  ['PEXPIRE', { run: keyCommands.pexpire, minArgs: 2, maxArgs: 2, group: 'key' }],
  ['TTL', { run: keyCommands.ttl, minArgs: 1, maxArgs: 1, group: 'key' }],
  ['PTTL', { run: keyCommands.pttl, minArgs: 1, maxArgs: 1, group: 'key' }],
  ['PERSIST', { run: keyCommands.persist, minArgs: 1, maxArgs: 1, group: 'key' }],
  ['EXPIRETIME', { run: keyCommands.expiretime, minArgs: 1, maxArgs: 1, group: 'key' }],
  ['RENAME', { run: keyCommands.rename, minArgs: 2, maxArgs: 2, group: 'key' }],
  ['FLUSHDB', { run: (dbId) => keyStore.deleteByDatabase(dbId).then(() => 'OK'), minArgs: 0, maxArgs: 0, group: 'key' }],
  ['SWEEP', { run: () => keyStore.sweepAllExpired(), minArgs: 0, maxArgs: 0, group: 'key' }],
  // lists
  ['LPUSH', { run: lists.lpush, minArgs: 2, maxArgs: 256, group: 'list' }],
  ['RPUSH', { run: lists.rpush, minArgs: 2, maxArgs: 256, group: 'list' }],
  ['LPOP', { run: lists.lpop, minArgs: 1, maxArgs: 2, group: 'list' }],
  ['RPOP', { run: lists.rpop, minArgs: 1, maxArgs: 2, group: 'list' }],
  ['LRANGE', { run: lists.lrange, minArgs: 3, maxArgs: 3, group: 'list' }],
  ['LLEN', { run: lists.llen, minArgs: 1, maxArgs: 1, group: 'list' }],
  ['LINDEX', { run: lists.lindex, minArgs: 2, maxArgs: 2, group: 'list' }],
  ['LSET', { run: lists.lset, minArgs: 3, maxArgs: 3, group: 'list' }],
  ['LTRIM', { run: lists.ltrim, minArgs: 3, maxArgs: 3, group: 'list' }],
  ['LREM', { run: lists.lrem, minArgs: 3, maxArgs: 3, group: 'list' }],
  // sets
  ['SADD', { run: sets.sadd, minArgs: 2, maxArgs: 256, group: 'set' }],
  ['SREM', { run: sets.srem, minArgs: 2, maxArgs: 256, group: 'set' }],
  ['SISMEMBER', { run: sets.sismember, minArgs: 2, maxArgs: 2, group: 'set' }],
  ['SMEMBERS', { run: sets.smembers, minArgs: 1, maxArgs: 1, group: 'set' }],
  ['SCARD', { run: sets.scard, minArgs: 1, maxArgs: 1, group: 'set' }],
  ['SINTER', { run: sets.sinter, minArgs: 2, maxArgs: 256, group: 'set' }],
  ['SUNION', { run: sets.sunion, minArgs: 2, maxArgs: 256, group: 'set' }],
  ['SDIFF', { run: sets.sdiff, minArgs: 2, maxArgs: 256, group: 'set' }],
  // hashes
  ['HSET', { run: hashes.hset, minArgs: 3, maxArgs: 256, group: 'hash' }],
  ['HGET', { run: hashes.hget, minArgs: 2, maxArgs: 2, group: 'hash' }],
  ['HGETALL', { run: hashes.hgetall, minArgs: 1, maxArgs: 1, group: 'hash' }],
  ['HDEL', { run: hashes.hdel, minArgs: 2, maxArgs: 256, group: 'hash' }],
  ['HKEYS', { run: hashes.hkeys, minArgs: 1, maxArgs: 1, group: 'hash' }],
  ['HVALS', { run: hashes.hvals, minArgs: 1, maxArgs: 1, group: 'hash' }],
  ['HLEN', { run: hashes.hlen, minArgs: 1, maxArgs: 1, group: 'hash' }],
  ['HEXISTS', { run: hashes.hexists, minArgs: 2, maxArgs: 2, group: 'hash' }],
  // sorted sets
  ['ZADD', { run: zsets.zadd, minArgs: 3, maxArgs: 256, group: 'zset' }],
  ['ZSCORE', { run: zsets.zscore, minArgs: 2, maxArgs: 2, group: 'zset' }],
  ['ZCARD', { run: zsets.zcard, minArgs: 1, maxArgs: 1, group: 'zset' }],
  ['ZREM', { run: zsets.zrem, minArgs: 2, maxArgs: 256, group: 'zset' }],
  ['ZRANGE', { run: zsets.zrange, minArgs: 3, maxArgs: 4, group: 'zset' }],
]);

function isPlainArg(value) {
  return typeof value === 'string'
    || (typeof value === 'number' && Number.isFinite(value))
    || typeof value === 'boolean';
}

function resolveEntry(command, args) {
  const entry = COMMANDS.get(String(command).toUpperCase());
  if (!entry) {
    throw new EngineError(`unknown command '${String(command).toUpperCase()}'`);
  }
  if (!Array.isArray(args) || args.some((arg) => !isPlainArg(arg))) {
    throw new EngineError('command args must be an array of strings/numbers', 'ERR_ARGS');
  }
  if (args.length < entry.minArgs || args.length > entry.maxArgs) {
    throw new EngineError(
      `wrong number of arguments for '${String(command).toUpperCase()}' command`,
      'ERR_ARGS',
    );
  }
  return entry;
}

/**
 * Execute a single command for one logical database against the key store.
 * `command` must be uppercase registry name; `args` an array of primitives.
 */
async function executeDatabaseCommand(dbRecordId, command, args = []) {
  const entry = resolveEntry(command, args);
  try {
    return await entry.run(dbRecordId, args.map((a) => String(a)));
  } catch (err) {
    if (err && err.redis) throw new EngineError(err.message);
    throw err;
  }
}

/**
 * Validate a command against the registry without executing it (used by the
 * remote driver path, which enforces the same surface as the local engine).
 */
function validateRegistryCommand(command, args = []) {
  resolveEntry(command, args);
}

/** Execute multiple commands sequentially; stops at first failure and callers snapshot/restore for atomicity. */
async function executeDatabasePipeline(dbRecordId, commands) {
  const results = [];
  for (const item of commands) {
    results.push({
      command: item.command,
      result: await executeDatabaseCommand(dbRecordId, item.command, item.args || []),
    });
  }
  return results;
}

/** Delete every expired key belonging to one logical database (maintenance helper). */
function sweepDatabaseExpired(dbRecordId) {
  return keyStore.sweepExpired(dbRecordId);
}

module.exports = {
  EngineError,
  COMMANDS,
  executeDatabaseCommand,
  executeDatabasePipeline,
  sweepDatabaseExpired,
  validateRegistryCommand,
};

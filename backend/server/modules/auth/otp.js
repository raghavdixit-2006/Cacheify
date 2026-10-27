'use strict';

/**
 * Email-verification OTP service.
 *
 * Storage dogfoods THIS platform: codes live in the managed Redis data plane
 * (remote mode) under an internal namespace, hashed and absolutely TTL-bound
 * (mandatory-expiry policy applies). In embedded/dev mode a small in-memory
 * store with the same semantics is used so flows complete without a server.
 *
 * Semantics:
 *  - 6-digit code, SHA-256(pepper + code) stored, 10-minute TTL (configurable).
 *  - Resend cooldown per account (default 60 s).
 *  - Brute-force bound: max verification attempts (default 5), then wipe.
 *  - Codes NEVER appear in responses when a real email provider is configured.
 */

const crypto = require('node:crypto');
const { config } = require('../../core/env');const errors = require('../../core/errors');
const audit = require('../../core/audit');
const dal = require('./dal');
const brevo = require('../integrations/brevo');

/* The driver namespaces keys; any string works as long as it is stable. */
const OTP_NAMESPACE = 'PLATFORM.INTERNAL';
const DRIVER = () => {
  try {
    return require('../data/remote-driver');
  } catch (_err) {
    return null;
  }
};

const TTL_MS = () => config.otp.ttlMs;

/* ---------------------------- per-mode stores ----------------------------- */

/* In-memory fallback (embedded dev mode): entries expire like real keys. */
const memoryStore = new Map(); // key -> { value, expiresAt, inflight-threads }

function memoryGet(key) {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key, value, ttlMs) {
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function memoryTtlSeconds(key) {
  const entry = memoryStore.get(key);
  if (!entry) return -2;
  const left = Math.ceil((entry.expiresAt - Date.now()) / 1000);
  return left > 0 ? left : -2;
}

function memoryDelete(key) {
  memoryStore.delete(key);
}

/* Unified primitives over Redis (remote) or memory (embedded). */
const isRemote = config.redis.mode === 'remote';

async function storeGet(key) {
  if (!isRemote) return memoryGet(key);
  const driver = DRIVER();
  try {
    const value = await driver.execute(OTP_NAMESPACE, 'GET', [key]);
    return value === null ? null : String(value);
  } catch (err) {
    if (err && err.status) throw err;
    throw new errors.ServiceUnavailableError('OTP store unavailable');
  }
}

async function storeSet(key, value, ttlMs) {
  if (!isRemote) {
    memorySet(key, value, ttlMs);
    return;
  }
  await DRIVER().execute(OTP_NAMESPACE, 'SET', [key, value, 'PX', String(ttlMs)]);
}

async function storeTtl(key) {
  if (!isRemote) return memoryTtlSeconds(key);
  const value = await DRIVER().execute(OTP_NAMESPACE, 'TTL', [key]);
  return Number(value);
}

async function storeDel(key) {
  if (!isRemote) {
    memoryDelete(key);
    return;
  }
  await DRIVER().execute(OTP_NAMESPACE, 'DEL', [key]);
}

/* ------------------------------- the policy -------------------------------- */

const hashCode = (code) => crypto
  .createHash('sha256')
  .update(`${config.jwtSecret}:${code}`)
  .digest('hex');

const codeKey = (userId) => `otp:code:u${userId}`;
const attemptsKey = (userId) => `otp:attempts:u${userId}`;
const cooldownKey = (userId) => `otp:cooldown:u${userId}`;

function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Request a verification code for the signed-in user (resend cooldown-aware). */
async function requestOtp(user, context = {}) {
  const cooldownLeft = await storeTtl(cooldownKey(user.id));
  if (cooldownLeft > 0) {
    throw new errors.RateLimitError(`Please wait ${cooldownLeft}s before requesting a new code`);
  }
  const code = generateCode();
  await storeSet(codeKey(user.id), hashCode(code), TTL_MS());
  await storeSet(attemptsKey(user.id), '0', TTL_MS());
  await storeSet(cooldownKey(user.id), '1', config.otp.resendCooldownMs);
  try {
    await brevo.sendOtpEmail(user.email, code, Math.round(TTL_MS() / 60_000));
  } catch (err) {
    await storeDel(codeKey(user.id)); // no usable code without a delivery path
    await storeDel(attemptsKey(user.id));
    throw err;
  }
  await audit.record({
    actorUserId: user.id,
    action: 'user.otp_requested',
    targetType: 'user',
    targetId: user.public_id,
    requestId: context.requestId,
  });
  const result = { sent: true, expiresInSeconds: Math.round(TTL_MS() / 1000) };
  const mock = await brevo.mockMode();
  if (mock) {
    /* Mock mode only (no email provider configured): the platform cannot
       deliver email, so the code is surfaced locally to keep the flow
       testable. */
    result.devCodeOverride = code;
  }
  return result;
}

/** Verify the code for the signed-in user; unlocks the account on success. */
async function verifyOtp(user, code, context = {}) {
  const storedHash = await storeGet(codeKey(user.id));
  if (!storedHash) {
    throw new errors.ValidationError('No active verification code: request a new one');
  }
  const attempts = Number(await storeGet(attemptsKey(user.id)) || 0) + 1;
  if (attempts > config.otp.maxAttempts) {
    await storeDel(codeKey(user.id));
    await storeDel(attemptsKey(user.id));
    throw new errors.RateLimitError('Too many wrong attempts: request a new code');
  }
  if (hashCode(String(code).trim()) !== storedHash) {
    await storeSet(attemptsKey(user.id), String(attempts), TTL_MS());
    throw new errors.ValidationError('Verification code is wrong or expired');
  }
  await storeDel(codeKey(user.id));
  await storeDel(attemptsKey(user.id));
  await dal.setEmailVerified(user.id);  await audit.record({
    actorUserId: user.id,
    action: 'user.email_verified',
    targetType: 'user',
    targetId: user.public_id,
    requestId: context.requestId,
  });
  return { verified: true, email: user.email };
}

module.exports = { requestOtp, verifyOtp };

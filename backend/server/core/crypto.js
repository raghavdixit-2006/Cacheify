'use strict';

/** Cryptographic helpers: HMAC-signed session tokens, hashing, random secrets. */

const crypto = require('node:crypto');

const { config } = require('./env');

function base64UrlEncode(buf) {
  return buf.toString('base64url');
}

/** Sign a payload into an HS256 JWT-style compact token. */
function signToken(payload, ttlMs = config.jwtTtlMs) {
  const header = base64UrlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64UrlEncode(
    Buffer.from(
      JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + ttlMs }),
    ),
  );
  const signature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

/** Verify and decode a signed token; returns null when invalid or expired. */
function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  const expected = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${header}.${body}`)
    .digest('base64url');

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (_err) {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
  return payload;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Generate a URL-safe opaque public id (non-enumerable, safe to expose). */
function publicId(prefix = '') {
  return prefix ? `${prefix}_${crypto.randomUUID()}` : crypto.randomUUID();
}

/** Random API key material: plaintext token shown once, prefix for display. */
function generateApiKey() {
  const secret = crypto.randomBytes(24).toString('base64url'); // 32 chars
  const plaintext = `rk_${secret}`;
  return { plaintext, keyHash: hashApiKey(plaintext), prefix: plaintext.slice(0, 8) };
}

/** API keys are looked up by SHA-256 hash, never stored in plaintext. */
function hashApiKey(plaintext) {
  return crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

/** Short 12-char hex namespace for per-database key prefixing on a shared Redis. */
function shortNamespace() {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

module.exports = {
  signToken,
  verifyToken,
  sha256Hex,
  publicId,
  generateApiKey,
  hashApiKey,
  shortNamespace,
};

'use strict';

/** Structured JSON logging with requestId correlation and PII/credential redaction. */

const SENSITIVE_KEY_PATTERN = /(password|passphrase|secret|token|api[-_]?key|authorization|cookie)/i;

function redact(value, depth = 0) {
  if (value == null || depth > 6) return typeof value === 'object' ? '[Deep]' : value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : redact(val, depth + 1);
    }
    return out;
  }
  return value;
}

function emit(level, event, context = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    requestId: context.requestId || undefined,
    ...(redact(context)),
  });
  // eslint-disable-next-line no-console
  console[level === 'error' || level === 'fatal' ? 'error' : 'log'](line);
}

module.exports = {
  info: (event, context) => emit('info', event, context),
  warn: (event, context) => emit('warn', event, context),
  error: (event, context) => emit('error', event, context),
};

'use strict';

/** Audit log helper (core): append-only compliance trail in MongoDB. */

const store = require('./store');
const logger = require('./logger');

/** Fire-and-forget: compliance writes must never fail a request. Failures are
    logged for observability instead of throwing into HTTP responses. */
function record({ actorUserId = null, action, targetType = null, targetId = null, metadata = null, requestId = null }) {
  return (async () => {
    const logs = await store.getAuditLogs();
    await logs.insertOne({
      actor_user_id: actorUserId,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata: metadata ? JSON.stringify(metadata) : null,
      request_id: requestId,
      created_at: store.nowIso(),
    });
  })().catch((err) => {
    logger.warn('audit_write_failed', { action, error: String(err && err.message).slice(0, 160) });
  });
}

module.exports = { record };

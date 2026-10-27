'use strict';

/** Deterministic JSON response envelopes for every endpoint. */

function ok(res, data = null, meta = undefined, status = 200) {
  return res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

function created(res, data, meta = undefined) {
  return ok(res, data, meta, 201);
}

module.exports = { ok, created };

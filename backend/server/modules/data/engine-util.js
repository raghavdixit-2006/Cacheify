'use strict';

/** Millisecond clock and UTC timestamp helper shared by the engine. */

function nowMs() {
  return Date.now();
}

function now(ms = nowMs()) {
  return new Date(ms).toISOString();
}

module.exports = { nowMs, now };

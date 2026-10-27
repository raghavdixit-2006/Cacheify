'use strict';

/** Process bootstrap: HTTP listener, TTL sweep loop (local engine mode), graceful shutdown. */

const { config } = require('./core/env');
const logger = require('./core/logger');
const { sweepAllExpired } = require('./modules/data/engine-core');
const remoteDriver = require('./modules/data/remote-driver');
const { seedAdmin } = require('./core/bootstrap');
const { buildApp } = require('./app');

const IS_REMOTE = config.redis.mode === 'remote';

seedAdmin().catch((err) => {
  logger.error('admin_seed_failed', { error: err.message });
});

const app = buildApp();
const server = app.listen(config.port, config.host, () => {
  logger.info('server_started', {
    host: config.host,
    port: config.port,
    env: config.nodeEnv,
    dataPlane: IS_REMOTE ? 'remote_redis' : 'embedded',
  });
  if (IS_REMOTE) {
    remoteDriver
      .ping()
      .then(({ latencyMs }) => {
        logger.info('remote_redis_reachable', { latencyMs });
      })
      .catch((err) => {
        logger.warn('remote_redis_unreachable', { error: err.message });
      });
  }
});

/* Periodic TTL sweep keeps expired keys from accumulating between reads.
   Remote mode relies on native Redis expiry instead. */
const sweeper = IS_REMOTE
  ? { unref() {} } // no-op sweeper handle
  : setInterval(() => {
      (async () => {
        const removed = await sweepAllExpired();
        if (removed > 0) logger.info('ttl_sweep', { removed });
      })().catch((err) => {
        logger.error('ttl_sweep_failed', { error: err.message });
      });
    }, config.sweepIntervalMs);

function shutdown(signal) {
  logger.info('shutdown_begin', { signal });
  sweeper.unref();
  server.close(() => {
    const mongo = require('./modules/integrations/mongo');
    Promise.resolve(IS_REMOTE ? remoteDriver.close() : null)
      .catch(() => {})
      .then(() => mongo.close())
      .catch(() => {})
      .then(() => {
        logger.info('shutdown_complete', {});
        process.exit(0);
      });
  });
  // Hard stop after grace period in case of leaked keep-alive connections.
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

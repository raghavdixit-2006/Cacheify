#!/usr/bin/env node
'use strict';

/** TEMPORARY ioredis connectivity probe (prints no credentials). Delete after use. */

const { config } = require('../server/core/env');
const Redis = require('ioredis');

const redis = new Redis(config.redis.connectionString, {
  maxRetriesPerRequest: 2,
  connectTimeout: 10000,
  commandTimeout: 10000,
  retryStrategy: (t) => Math.min(t * 500, 5000),
});

redis.on('connect', () => console.log('event: connect'));
redis.on('reconnecting', () => console.log('event: reconnecting'));
redis.on('error', (err) => console.log('event: error:', err.message));
redis.on('close', () => console.log('event: close'));

redis.ping()
  .then((reply) => console.log('ping reply:', reply))
  .then(() => redis.info('server'))
  .then((info) => {
    const version = (info.split('\n').find((l) => l.includes('redis_version')) || '(missing)').trim();
    console.log('server version:', version);
    return redis.quit();
  })
  .then(() => {
    console.log('probe: done');
    process.exit(0);
  })
  .catch((err) => {
    console.log('probe: failed —', err.message);
    process.exit(1);
  });

setTimeout(() => {
  console.log('watchdog: no reply within 15s');
  process.exit(1);
}, 15000);

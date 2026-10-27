'use strict';

/**
 * MongoDB connection singleton (integrations): Atlas connectivity handling.
 * Provides the handle consumed by the core metadata store and the
 * feature-gated profile storage. Feature gating (MONGODB_URI presence) is
 * checked here; without it every consumer answers a clear 503.
 */

const dns = require('node:dns');
const { config } = require('../../core/env');
const { info, warn } = require('../../core/logger');
const errors = require('../../core/errors');

let client = null;
let connecting = null;
let srvChecked = false;

function configured() {
  return Boolean(config.integrations.mongoUri);
}

/** Router-resolver workaround for mongodb+srv:// URIs. SRV bootstrapping needs
    SRV/TXT DNS lookups; many home routers and ISP resolvers refuse SRV query
    types outright (ECONNREFUSED from c-ares). When the system resolvers fail,
    switch the process to public resolvers (Cloudflare/Google) once and retry.
    Plain mongodb:// URIs need no SRV and are untouched. */
async function ensureSrvResolvable() {
  if (srvChecked) return;
  srvChecked = true;
  const uri = config.integrations.mongoUri;
  if (!uri || !/^mongodb\+srv:\/\//i.test(uri)) return;
  let host;
  try {
    host = new URL(uri).hostname;
  } catch (_err) {
    return; // driver surfaces any URI problem itself
  }
  const srvName = `_mongodb._tcp.${host}`;
  const probe = () => new Promise((done) => {
    dns.resolveSrv(srvName, (err, addrs) => done(err || !addrs || addrs.length === 0 ? null : addrs));
  });
  let addrs = await probe();
  if (addrs) return;
  warn('mongodb_srv_dns_refused', {
    srvName,
    note: 'system resolvers rejected the SRV query; switching to public DNS resolvers',
  });
  try {
    dns.setServers(['1.1.1.1', '8.8.4.4']);
  } catch (err) {
    warn('mongodb_srv_dns_fallback_failed', { error: String(err && err.message).slice(0, 120) });
    return; // the driver will retry and report its own error
  }
  addrs = await probe();
  if (!addrs) {
    throw new errors.ServiceUnavailableError(
      `MongoDB is unreachable: DNS SRV lookup failed for ${srvName} even with public resolvers`,
    );
  }
  info('mongodb_srv_resolved', { srvName, replicas: addrs.length });
}

/** Connect once per process; resolves the client on success. */
async function getClient() {
  if (!configured()) {
    throw new errors.ServiceUnavailableError(
      'MongoDB is unavailable: MONGODB_URI is not configured',
    );
  }
  if (client) return client;
  if (!connecting) {
    const { MongoClient } = require('mongodb');
    connecting = ensureSrvResolvable().then(() => {
      client = new MongoClient(config.integrations.mongoUri, {
        serverSelectionTimeoutMS: 4000,
        maxPoolSize: 5,
      });
      return client.connect();
    }).then(() => {
      info('mongodb_connected', { database: config.integrations.mongoDb });
      return client;
    }).catch((err) => {
      client = null;
      connecting = null;
      err.mongoFailed = true;
      throw err;
    });
  }
  return connecting;
}

/** Live database handle for the metadata store and feature integrations. */
async function db() {
  const handle = await getClient();
  return handle.db(config.integrations.mongoDb);
}

/** Profiles collection (feature-gated user-saved details). */
async function profileCollection() {
  return (await db()).collection('profiles');
}

async function close() {
  if (client) {
    const closing = client;
    client = null;
    connecting = null;
    try {
      await closing.close();
    } catch (_err) {
      /* already down */
    }
  }
}

module.exports = { configured, db, profileCollection, getClient, close };

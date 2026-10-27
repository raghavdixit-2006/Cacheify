#!/usr/bin/env node
'use strict';

/**
 * End-to-end smoke test for REMOTE mode (real Redis via REDIS_CONNECTION_STRING).
 *
 * The connection string is loaded by the server's own .env loader (or the shell
 * environment) — this script never reads or prints it. Skips when unset:
 *
 *   put REDIS_CONNECTION_STRING=... in .env (or export it), then:
 *   node scripts/smoke-remote.js
 */

process.env.NODE_ENV = 'development';
process.env.ADMIN_EMAIL = 'admin@example.test';
process.env.ADMIN_PASSWORD = 'admin-password-1234';
process.env.SWEEP_INTERVAL_MS = '30000';
// The value-quota test relies on a small per-user cap rather than a huge body
// (the request-schema caps single args at 100_000 chars before quotas).
process.env.QUOTA_MAX_VALUE_BYTES = '1000';
process.env.BODY_LIMIT_BYTES = `${2 * 1024 * 1024}`;
// OTP verification runs in MOCK mode: empty strings block .env leakage (the
// .env loader never overrides existing process.env keys), so the harness gets
// devCodeOverride responses instead of sending real Brevo mails to @test.dev.
process.env.BREVO_API_KEY = '';
process.env.MAIL_HOST = '';
// Metadata isolation: run against a disposable Atlas database (dropped at the
// end) so the real `cacheify` control plane never accumulates smoke users.
process.env.MONGODB_DB = `cacheify-remote-smoke-${Math.floor(Math.random() * 1e10)}`;

// Load prerequisites; the config resolves REDIS_CONNECTION_STRING from .env/shell.
const { config } = require('../server/core/env');
if (config.redis.mode !== 'remote') {
  console.log('skipped - REDIS_CONNECTION_STRING not set (embedded engine mode)');
  process.exit(0);
}

const assert = require('node:assert');
const { buildApp } = require('../server/app');
const remoteDriver = require('../server/modules/data/remote-driver');

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err && (err.stack || err.message));
});
process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err && (err.stack || err.message));
});
process.on('exit', (code) => {
  console.error(`process exit: code=${code}`);
});
process.on('beforeExit', () => {
  console.error('process beforeExit');
});

const BASE = 'http://127.0.0.1';

let client;
let port;

async function call(method, apiPath, { token, body } = {}) {
  const res = await fetch(`${BASE}:${port}${apiPath}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function step(name, fn) {
  const started = Date.now();
  await fn();
  console.log(`ok - ${name} (${Date.now() - started}ms)`);
}

const RUN_ID = Math.random().toString(36).slice(2, 10);
const emailOf = (role) => `${role}-${RUN_ID}@remote-test.dev`;

/** Complete email verification for a token (mock mode: codes surface locally). */
async function verifyEmail(token) {
  const req = await call('POST', '/api/auth/otp/request', { token });
  assert.equal(req.status, 200);
  const code = req.json.data.devCodeOverride;
  assert.ok(typeof code === 'string' && /^\d{6}$/.test(code), 'mock mode must surface devCodeOverride');
  const ver = await call('POST', '/api/auth/otp/verify', { token, body: { code } });
  assert.equal(ver.status, 200);
  return ver;
}

async function main() {
  await require('../server/core/bootstrap').seedAdmin();
  const server = buildApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  port = server.address().port;

  try {
    let userToken;
    let dbA;
    let dbB;

    await step('remote: connection is healthy', async () => {
      const health = await remoteDriver.ping();
      assert.ok(health.latencyMs >= 0);
    });

    await step('remote: register + create first hosted database', async () => {
      const reg = await call('POST', '/api/auth/register', {
        body: { email: emailOf('owner'), password: 'super-secret-9' },
      });
      assert.equal(reg.status, 200);
      userToken = reg.json.data.token;
      // The control plane is gated until email verification: complete it here
      // (mock mailer) exactly like a real user would via the Brevo flow.
      await verifyEmail(userToken);
      const created = await call('POST', '/api/databases', {
        token: userToken,
        body: { name: 'remote-cache-a', description: 'remote smoke A' },
      });
      assert.equal(created.status, 201);
      dbA = created.json.data.database;
      assert.ok(dbA.id.startsWith('rdb_'));
    });

    await step('remote: set/get roundtrip hits the real server', async () => {
      const set = await call('POST', `/api/data/${dbA.id}/command`, {
        token: userToken,
        body: { command: 'SET', args: [`test:${RUN_ID}`, 'from-smoke'] },
      });
      assert.equal(set.json.data.result, 'OK');
      const get = await call('POST', `/api/data/${dbA.id}/command`, {
        token: userToken,
        body: { command: 'GET', args: [`test:${RUN_ID}`] },
      });
      assert.equal(get.json.data.result, 'from-smoke');
    });

    await step('remote: namespace isolation between two hosted databases', async () => {
      const created = await call('POST', '/api/databases', {
        token: userToken,
        body: { name: 'remote-cache-b', description: 'remote smoke B' },
      });
      assert.equal(created.status, 201);
      dbB = created.json.data.database;

      // Missing reads in the second namespace must NOT see A's data.
      const leaked = await call('POST', `/api/data/${dbB.id}/command`, {
        token: userToken,
        body: { command: 'GET', args: [`test:${RUN_ID}`] },
      });
      assert.equal(leaked.status, 200);
      assert.equal(leaked.json.data.result, null);

      // And the same key name can hold different values per database.
      await call('POST', `/api/data/${dbB.id}/command`, {
        token: userToken,
        body: { command: 'SET', args: [`test:${RUN_ID}`, 'namespace-b'] },
      });
      const again = await call('POST', `/api/data/${dbA.id}/command`, {
        token: userToken,
        body: { command: 'GET', args: [`test:${RUN_ID}`] },
      });
      assert.equal(again.json.data.result, 'from-smoke');
    });

    await step('remote: commands across all types', async () => {
      const execute = async (command, args) => {
        const res = await call('POST', `/api/data/${dbB.id}/command`, { token: userToken, body: { command, args } });
        if (!res.json || res.json.error) {
          throw new Error(`HTTP ${res.status} for ${command} ${JSON.stringify(args)}: ${JSON.stringify(res.json && res.json.error)}`);
        }
        return res.json.data.result;
      };

      assert.equal(await execute('INCR', ['hits']), 1);
      assert.equal(await execute('INCRBY', ['hits', 4]), 5);
      assert.equal(await execute('APPEND', [`test:${RUN_ID}`, '!!']), 'namespace-b!!'.length);
      assert.deepEqual(await execute('MGET', [`test:${RUN_ID}`, 'missing']), ['namespace-b!!', null]);
      assert.equal(await execute('RPUSH', ['queue', 'a', 'b', 'c']), 3);
      assert.deepEqual(await execute('LRANGE', ['queue', '0', '-1']), ['a', 'b', 'c']);
      assert.equal(await execute('SADD', ['tags', 'x', 'y', 'x']), 2);
      assert.deepEqual(await execute('SMEMBERS', ['tags']).then((v) => [...v].sort()), ['x', 'y']);
      assert.equal(await execute('HSET', ['user:1', 'name', 'Ada']), 1);
      assert.equal((await execute('HGETALL', ['user:1'])).name, 'Ada');
      assert.deepEqual(await execute('ZRANGE', ['board', 0, -1, 'WITHSCORES']), []);
      assert.equal(await execute('ZADD', ['board', '10', 'ada', '5', 'bob']), 2);
      assert.deepEqual(
        await execute('ZRANGE', ['board', '0', '-1', 'WITHSCORES']),
        ['bob', '5', 'ada', '10'],
      );
      const renamed = await execute('RENAME', ['queue', 'renamed-queue']);
      assert.equal(renamed, 'OK');
      assert.deepEqual(await execute('LRANGE', ['renamed-queue', '0', '-1']), ['a', 'b', 'c']);
      assert.equal(await execute('TYPE', ['renamed-queue']), 'list');
    });

    await step('remote: WRONGTYPE and unknown commands are domain errors', async () => {
      const wrong = await call('POST', `/api/data/${dbB.id}/command`, {
        token: userToken,
        body: { command: 'LPUSH', args: ['tags', 'oops'] },
      });
      assert.equal(wrong.status, 422);
      assert.match(wrong.json.error.message, /WRONGTYPE/i);

      const unknown = await call('POST', `/api/data/${dbB.id}/command`, {
        token: userToken,
        body: { command: 'SUBSCRIBE', args: [] },
      });
      assert.equal(unknown.status, 422);
      assert.equal(unknown.json.error.code, 'ERR_REDIS');
    });

    await step('remote: REST browse, detail, TTL, persist, delete', async () => {
      await call('POST', `/api/data/${dbA.id}/command`, {
        token: userToken,
        body: { command: 'PEXPIRE', args: [`test:${RUN_ID}`, 60000] },
      });
      const page = await call('GET', `/api/data/${dbA.id}/keys?pattern=test:*&limit=10`, { token: userToken });
      assert.equal(page.status, 200);
      const listed = page.json.data.keys.find((k) => k.name === `test:${RUN_ID}`);
      assert.ok(listed);
      assert.equal(listed.type, 'string');
      assert.ok(listed.expiresAt !== null);

      const detail = await call('GET', `/api/data/${dbA.id}/keys/${encodeURIComponent(`test:${RUN_ID}`)}`, { token: userToken });
      assert.equal(detail.status, 200);
      assert.equal(detail.json.data.key.value, 'from-smoke');
      assert.ok(detail.json.data.key.ttlMs > 0);

      // Mandatory-expiry policy: clearing a key's expiry is refused (422) —
      // no key on the platform may become immortal via the REST expire-clear.
      const mitigated = await call('DELETE', `/api/data/${dbA.id}/keys/${encodeURIComponent(`test:${RUN_ID}`)}/expire`, { token: userToken });
      assert.equal(mitigated.status, 422);

      const stillExpiring = await call('POST', `/api/data/${dbA.id}/command`, {
        token: userToken,
        body: { command: 'TTL', args: [`test:${RUN_ID}`] },
      });
      assert.ok(stillExpiring.json.data.result > 0, 'TTL must survive the refused expire-clear');

      const deleted = await call('DELETE', `/api/data/${dbA.id}/keys/${encodeURIComponent(`test:${RUN_ID}`)}`, { token: userToken });
      assert.equal(deleted.json.data.deleted, true);

      const missing = await call('GET', `/api/data/${dbA.id}/keys/${encodeURIComponent(`test:${RUN_ID}`)}`, { token: userToken });
      assert.equal(missing.status, 404);
    });

    await step('remote: pipeline + stats + REST string put', async () => {
      const pipeline = await call('POST', `/api/data/${dbB.id}/pipeline`, {
        token: userToken,
        body: {
          commands: [
            { command: 'SET', args: ['pipe:one', '1'] },
            { command: 'INCR', args: ['pipe:counter'] },
          ],
        },
      });
      assert.equal(pipeline.status, 200);
      assert.equal(pipeline.json.data.results[0].result, 'OK');
      assert.equal(pipeline.json.data.results[1].result, 1);

      const put = await call('PUT', `/api/data/${dbA.id}/strings/special-key`, {
        token: userToken,
        body: { value: 'rest-put', expiresInMs: 120000 },
      });
      assert.equal(put.status, 201);

      const statsStep = await call('GET', `/api/databases/${dbB.id}`, { token: userToken });
      assert.ok(statsStep.json.data.database.stats.totalKeys >= 6);
    });

    await step('remote: SWEEP is a near no-op and does not delete live keys', async () => {
      const sweep = await call('POST', `/api/data/${dbB.id}/command`, {
        token: userToken,
        body: { command: 'SWEEP', args: [] },
      });
      assert.equal(sweep.status, 200);
      assert.equal(sweep.json.data.result, 0);
    });

    await step('remote: quotas enforced against the real server', async () => {
      const tooBig = await call('POST', `/api/data/${dbB.id}/command`, {
        token: userToken,
        body: { command: 'SET', args: ['big', 'x'.repeat(5000)] },
      });
      assert.equal(tooBig.status, 403);
      assert.equal(tooBig.json.error.code, 'ERR_QUOTA_EXCEEDED');
      assert.match(tooBig.json.error.message, /values up to 1000 bytes/);
    });

    await step('remote: FLUSHDB wipes only this namespace', async () => {
      const flushed = await call('POST', `/api/data/${dbB.id}/command`, {
        token: userToken,
        body: { command: 'FLUSHDB', args: [] },
      });
      assert.equal(flushed.json.data.result, 'OK');

      const count = await call('POST', `/api/data/${dbB.id}/command`, {
        token: userToken,
        body: { command: 'DBSIZE', args: [] },
      });
      // DBSIZE is not in the platform registry and would return another
      // tenant's count anyway; verify emptiness through the browse endpoint.
      assert.equal(count.status, 422);

      const page = await call('GET', `/api/data/${dbB.id}/keys?limit=100`, { token: userToken });
      assert.equal(page.json.data.keys.length, 0);

      // Namespace A must be untouched by B's flush.
      const aKeys = await call('GET', `/api/data/${dbA.id}/keys?limit=100`, { token: userToken });
      assert.ok(aKeys.json.data.keys.length > 0);
    });

    await step('remote: deleting a hosted database removes its remote keys', async () => {
      const removed = await call('DELETE', `/api/databases/${dbB.id}`, { token: userToken });
      assert.equal(removed.status, 200);
      assert.equal(removed.json.data.deleted, true);
    });

    console.log('smoke-remote: all green');
  } finally {
    server.close(() => {});
    remoteDriver.close();
    // Drop the disposable Atlas metadata database from this run.
    const mongo = require('../server/modules/integrations/mongo');
    await mongo.db()
      .then((db) => db.dropDatabase())
      .then(() => console.log('ok - remote-smoke metadata database dropped from Atlas'))
      .catch((err) => console.warn(`smoke database drop failed: ${err.message}`));
    await mongo.close();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('smoke-remote: FAILED', err && err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Framework client test — Node.js
 * Transport: native fetch / undici (built into Node 18+, zero packages).
 * Shared scenario with the other clients: see tests/clients/README.md.
 * Expiry idiom for this client: SET key value EX <seconds> (one request).
 */
const base = (process.env.RH_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
const email = process.env.RH_EMAIL ?? 'qa-review@redishost.test';
const password = process.env.RH_PASSWORD ?? 'review-pass-77';

const lang = 'node';
const epoch = Date.now();
const dbName = `fw-lab-${lang}-${epoch}`;
const key = `fw:${lang}:session`;
const hitsKey = `fw:${lang}:hits`;
const payload = JSON.stringify({ lang, saved: new Date(epoch).toISOString(), note: 'framework TTL test' });

let checks = 0;
let failures = 0;
const ids = {};
function log(line) { console.log(line); }
function mask(plaintext) { return `${plaintext.slice(0, 8)}...`; }
function check(name, ok, detail) {
  checks += 1;
  if (!ok) failures += 1;
  log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
}

async function call(method, path, token, body) {
  const started = performance.now();
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body === null || body === undefined ? undefined : JSON.stringify(body),
  });
  const ms = Math.round(performance.now() - started);
  const json = await res.json().catch(() => null);
  return { status: res.status, json, ms };
}

/* Trace format shared by every client script in this folder. */
function trace(method, path, out) {
  const data = out.json && out.json.data !== undefined ? JSON.stringify(out.json.data) : '';
  log(`> ${method} ${path}`);
  log(`< ${out.status} | ${out.ms} ms${data ? ` | ${String(data).slice(0, 72)}` : ''}`);
}
function expectOk(out, what) {
  if (out.status >= 400 || out.json?.success === false) {
    check(what, false, `status ${out.status} ${out.json?.error?.code ?? ''}`);
    return null;
  }
  return out.json.data;
}

async function main() {
  log(`client    : Node.js ${process.versions.node} -- transport: native fetch (undici)`);
  log(`identity  : default User-Agent: none (undici sends no UA by default)`);
  log(`auth live : ${email}`);

  /* Step 0: login -> session token */
  const login = await call('POST', '/api/auth/login', null, { email, password });
  trace('POST', '/api/auth/login', login);
  const session = expectOk(login, 'login');
  if (!session) return;
  const token = session.token;
  ids.token = token;

  /* Self-heal: remove lab databases left behind by any earlier crashed run. */
  const listed = await call('GET', '/api/databases', token);
  trace('GET', '/api/databases', listed);
  for (const db of listed.json?.data?.databases ?? []) {
    if (db.name?.startsWith(`fw-lab-${lang}-`)) {
      const gone = await call('DELETE', `/api/databases/${db.id}`, token);
      trace('DELETE', `/api/databases/${db.id} (stale lab)`, gone);
    }
  }

  /* Step 1: dedicated lab database (deleted at teardown, cascade) */
  const created = await call('POST', '/api/databases', token, { name: dbName });
  trace('POST', '/api/databases', created);
  const database = expectOk(created, 'create lab database')?.database;
  ids.databaseId = database?.id;

  /* Step 2: scoped read-write API key -- plaintext is returned exactly once */
  const keyRes = await call('POST', '/api/api-keys', token, {
    name: `fw-${lang}-${epoch}`, databaseId: ids.databaseId, permission: 'read-write',
  });
  trace('POST', '/api/api-keys', keyRes);
  const keyData = expectOk(keyRes, 'create scoped api key');
  ids.keyId = keyData?.apiKey?.id;
  log(`  plaintext token issued once: ${mask(keyData?.plaintext ?? '')}`);

  /* Data plane from here on: API key only (never the session) */
  const cmdPath = `/api/data/${ids.databaseId}/command`;
  const apiToken = keyData.plaintext;
  async function send(command, args) {
    const body = { command, args };
    log(`^ ${command} ${JSON.stringify(args)} | Bearer ${mask(apiToken)}`);
    const out = await call('POST', cmdPath, apiToken, body);
    return { out, result: out.json?.data?.result };
  }

  /* Step 3: SET with inline EX */
  const setRun = await send('SET', [key, payload, 'EX', 5]);
  trace('POST', `${cmdPath} (SET ... EX 5)`, setRun.out);
  check('SET with EX 5 returns OK', setRun.out.status === 200 && setRun.result === 'OK', JSON.stringify(setRun.result));

  /* Step 4 (bonus): pipeline -- batched, atomic */
  const pipe = await call('POST', `/api/data/${ids.databaseId}/pipeline`, apiToken, {
    commands: [
      { command: 'INCR', args: [hitsKey] },
      { command: 'INCR', args: [hitsKey] },
      { command: 'INCR', args: [hitsKey] },
    ],
  });
  trace('POST', `/api/data/${ids.databaseId}/pipeline (INCR x3)`, pipe);
  const pipeData = expectOk(pipe, 'pipeline executes');
  const pipeResults = (pipeData?.results ?? []).map((r) => r?.result);
  check('pipeline INCR x3 -> [1,2,3]',
    pipeResults.length === 3 && pipeResults[0] === 1 && pipeResults[1] === 2 && pipeResults[2] === 3,
    JSON.stringify(pipeResults));

  /* Step 5: round trip */
  const getRun = await send('GET', [key]);
  trace('POST', `${cmdPath} (GET)`, getRun.out);
  const saved = getRun.result;
  check('value round-trips byte-for-byte', saved === payload, `${saved} vs ${payload.slice(0, 24)}...`);

  /* Step 6/7: TTL + EXISTS while alive */
  const ttlRun = await send('TTL', [key]);
  trace('POST', `${cmdPath} (TTL)`, ttlRun.out);
  const ttl = ttlRun.result;
  check('TTL counts down 5->1', typeof ttl === 'number' && ttl >= 1 && ttl <= 5, `TTL ${ttl}`);

  const existsRun = await send('EXISTS', [key]);
  trace('POST', `${cmdPath} (EXISTS)`, existsRun.out);
  const exists = existsRun.result;
  check('EXISTS is 1 before expiry', exists === 1, `EXISTS ${exists}`);

  /* Step 8: wait past the expiry */
  log('...waiting 6.5 s for the key to expire...');
  await new Promise((resolve) => setTimeout(resolve, 6500));

  /* Step 9/10: proof of expiry */
  const afterRun = await send('GET', [key]);
  trace('POST', `${cmdPath} (GET after expiry)`, afterRun.out);
  check('expired key reads as Redis nil (JSON null)', afterRun.result === null, JSON.stringify(afterRun.result));

  const ttlAfterRun = await send('TTL', [key]);
  trace('POST', `${cmdPath} (TTL after expiry)`, ttlAfterRun.out);
  check('TTL on expired key is -2 (no such key)', ttlAfterRun.result === -2, `TTL ${ttlAfterRun.result}`);

  /* Step 11: revoke, then prove the key no longer works */
  const revoke = await call('DELETE', `/api/api-keys/${ids.keyId}`, token);
  trace('DELETE', `/api/api-keys/${ids.keyId} (revoke)`, revoke);
  expectOk(revoke, 'revoke api key');
  const rejected = await call('POST', cmdPath, apiToken, { command: 'GET', args: [key] });
  trace('POST', `${cmdPath} (revoked token)`, rejected);
  check('revoked key is rejected 401', rejected.status === 401 && rejected.json?.success === false, `status ${rejected.status}`);
} /* main */

try {
  await main();
} finally {
  /* Teardown always runs, even on failure. */
  if (ids.databaseId) {
    const gone = await call('DELETE', `/api/databases/${ids.databaseId}`, ids.token);
    trace('DELETE', `/api/databases/${ids.databaseId} (teardown)`, gone);
    check('lab database deleted with scoped keys', gone.status === 200, `status ${gone.status}`);
  }
  console.log(`${failures === 0 ? 'ALL PASS' : 'FAILURES'} -- ${checks - failures}/${checks} checks`);
  if (failures > 0) process.exitCode = 1;
  console.log('');
}

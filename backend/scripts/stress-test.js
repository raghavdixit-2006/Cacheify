#!/usr/bin/env node
/**
 * Stress harness for the data plane.
 *
 * Goal: store COUNT keys in this platform within a 60-second budget and
 * measure what the platform actually sustains, including the rate limiter.
 *
 * Modes:
 *  - single:   COUNT individual SET commands (POST /api/data/{db}/command).
 *              Expect the per-user limiter (default: 240 data requests/min)
 *              to reject the tail with 429 - that is the designed ceiling.
 *  - pipeline: COUNT SETs batched 50-per-request (POST /pipeline), the
 *              platform's intended bulk path - bypasses the per-request
 *              ceiling while storing the same number of commands.
 *
 * Each mode gets its own throwaway account + database + its single scoped
 * API key (one active key per database), and everything is deleted after.
 *
 * Usage:
 *   node scripts/stress-test.js [--mode all|single|pipeline] [--count 1000]
 *        [--concurrency 25] [--batch 50] [--base http://127.0.0.1:3000]
 */

const DEFAULTS = {
  mode: 'all',
  count: 1000,
  concurrency: 25,
  batch: 50,
  base: 'http://127.0.0.1:3000',
  budgetSec: 60,
};

function parseArgs(argv) {
  const out = { ...DEFAULTS };
  const positionals = [];
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const val = argv[i + 1];
    if (arg === '--mode') { out.mode = val; i += 1; }
    else if (arg === '--count') { out.count = Number(val); i += 1; }
    else if (arg === '--concurrency') { out.concurrency = Number(val); i += 1; }
    else if (arg === '--batch') { out.batch = Number(val); i += 1; }
    else if (arg === '--base') { out.base = val; i += 1; }
    else if (arg === '--help' || arg === '-h') { out.help = true; }
    else if (!arg.startsWith('--')) positionals.push(arg); // npm strips unknown --flags
  }
  // npm run stress -- <count> <concurrency> (positional fallback)
  if (positionals.length >= 1 && Number.isFinite(Number(positionals[0]))) out.count = Number(positionals[0]);
  if (positionals.length >= 2 && Number.isFinite(Number(positionals[1]))) out.concurrency = Number(positionals[1]);
  if (out.help) {
    console.log('node scripts/stress-test.js [--mode all|single|pipeline] [--count 1000]\n'
      + '                 [--concurrency 25] [--batch 50] [--base http://127.0.0.1:3000]\n'
      + '                 npm run stress -- 1000 25');
    process.exit(0);
  }
  return out;
}

/* Idempotent identity: register a dedicated stress user; fall back to login
   when it already exists from an earlier run. */
async function stressIdentity(base, label, epoch) {
  const email = `stress-${label}-${epoch}@cacheify.test`;
  const password = 'stress-test-77';
  const reg = await call(base, 'POST', '/api/auth/register', null, { email, password });
  if (reg.status < 400) return reg.json.data.token;
  const code = reg.json && reg.json.error ? reg.json.error.code : '';
  if (code === 'ERR_CONFLICT') {
    const login = await call(base, 'POST', '/api/auth/login', null, { email, password });
    if (login.status < 400) return login.json.data.token;
  }
  throw new Error(`identity setup failed (${reg.status} ${JSON.stringify(reg.json && reg.json.error)})`);
}

/* --------------------------------- helpers -------------------------------- */

async function call(base, method, path, token, body) {
  const started = Date.now();
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const took = Date.now() - started;
  const json = await res.json().catch(() => null);
  return { status: res.status, took, json, headers: res.headers };
}

const ascii = (s) => String(s).replace(/[^\x20-\x7E]/g, '');
const num = (v) => (v == null ? '-' : String(v));

function latencyStats(samples) {
  if (samples.length === 0) return { p50: null, p95: null, max: null, mean: null };
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    p50: pick(0.50),
    p95: pick(0.95),
    max: sorted[sorted.length - 1],
    mean: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
  };
}

function printLine(mode, label, value) {
  console.log(`  [${ascii(mode).padEnd(8)}] ${label}: ${ascii(value)}`);
}

/** Run `count` tasks with bounded concurrency; tasks report { ok, took, status }. */
async function runPool(total, concurrency, taskFn) {
  const results = [];
  let cursor = 0;
  async function worker() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= total) return;
      results[index] = await taskFn(index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  return results;
}

/* ------------------------------ phase: single ----------------------------- */

async function phaseSingle(cfg, epoch) {
  const tag = 'single';
  console.log(`\n=== MODE: single | ${cfg.count} individual SET commands | concurrency ${cfg.concurrency} ===`);

  // Identity: dedicated account so the /data rate bucket is exclusive.
  const sessionToken = await stressIdentity(cfg.base, 'single', epoch);

  const db = await call(cfg.base, 'POST', '/api/databases', sessionToken, { name: `stress-single-${epoch}` });
  const dbId = db.json && db.json.data && db.json.data.database && db.json.data.database.id;

  const key = await call(cfg.base, 'POST', `/api/databases/${dbId}/api-keys`, sessionToken, { name: 'stress-single' });
  const apiKey = key.json && key.json.data && key.json.data.plaintext;

  console.log(`  db=${dbId} key prefix=${(key.json.data.apiKey.prefix)}... path=POST /api/data/{db}/command`);

  const started = Date.now();
  const results = await runPool(cfg.count, cfg.concurrency, (i) => call(
    cfg.base, 'POST', `/api/data/${dbId}/command`, apiKey,
    { command: 'SET', args: [`stress:${String(i).padStart(5, '0')}`, `v${i}-stressblock`.slice(0, 40)] },
  ));
  const wallSec = (Date.now() - started) / 1000;

  const ok = results.filter((r) => r.status < 300);
  const byStatus = {};
  for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  const throttled = results.filter((r) => r.status === 429);
  const limitedHeader = throttled[0] ? throttled[0].headers.get('x-ratelimit-limit') : null;
  const retryAfter = throttled[0] ? throttled[0].headers.get('retry-after') : null;

  // Verified count via the control-plane stats (separate quota, no 429).
  const stats = await call(cfg.base, 'GET', `/api/databases/${dbId}`, sessionToken);
  const stored = stats.json && stats.json.data && stats.json.data.database
    && stats.json.data.database.stats ? stats.json.data.database.stats.totalKeys : null;

  console.log(`  wall time        : ${wallSec.toFixed(1)} s (budget ${cfg.budgetSec} s)`);
  console.log(`  ok (2xx)         : ${ok.length}`);
  console.log(`  429 throttled    : ${throttled.length}${limitedHeader ? ` (X-RateLimit-Limit=${limitedHeader}${retryAfter ? `, first Retry-After=${retryAfter}s` : ''})` : ''}`);
  console.log(`  statuses         : ${JSON.stringify(byStatus)}`);
  const lat = latencyStats(ok.map((r) => r.took));
  console.log(`  latency ok  ms   : mean=${num(lat.mean)} p50=${num(lat.p50)} p95=${num(lat.p95)} max=${num(lat.max)}`);
  console.log(`  stores/second    : ${(ok.length / wallSec).toFixed(1)} (limit-pierced at ${Math.min(cfg.count, (limitedHeader ? Number(limitedHeader) : Infinity))})`);
  console.log(`  stored (stats)   : ${num(stored)}`);

  await call(cfg.base, 'DELETE', `/api/databases/${dbId}`, sessionToken);
  console.log('  teardown: database deleted (keys cascaded)');

  return { mode: 'single', wallSec, ok: ok.length, stored };
}

/* ----------------------------- phase: pipeline ---------------------------- */

async function phasePipeline(cfg, epoch) {
  const tag = 'pipeline';
  const batch = Math.max(1, Math.min(cfg.batch, 50));
  console.log(`\n=== MODE: pipeline | ${cfg.count} SETs in batches of ${batch} (POST /pipeline) ===`);

  const sessionToken = await stressIdentity(cfg.base, 'pipeline', epoch);

  const db = await call(cfg.base, 'POST', '/api/databases', sessionToken, { name: `stress-pipeline-${epoch}` });
  const dbId = db.json && db.json.data && db.json.data.database && db.json.data.database.id;
  const key = await call(cfg.base, 'POST', `/api/databases/${dbId}/api-keys`, sessionToken, { name: 'stress-pipeline' });
  const apiKey = key.json && key.json.data && key.json.data.plaintext;

  const started = Date.now();
  const batches = [];
  for (let i = 0; i < cfg.count; i += batch) batches.push(i);
  let storedInReplies = 0;

  const results = await runPool(batches.length, cfg.concurrency, async (b) => {
    const offset = batches[b];
    const size = Math.min(batch, cfg.count - offset);
    const commands = Array.from({ length: size }, (_, j) => ({
      command: 'SET',
      args: [`stress:${String(offset + j).padStart(5, '0')}`, `v${offset + j}-stressblock`.slice(0, 40)],
    }));
    const r = await call(cfg.base, 'POST', `/api/data/${dbId}/pipeline`, apiKey, { commands });
    const applied = r.status < 300 && r.json && r.json.data && Array.isArray(r.json.data.results)
      ? r.json.data.results.filter((x) => x && x.result === 'OK').length : 0;
    storedInReplies += applied;
    return r;
  });
  const wallSec = (Date.now() - started) / 1000;

  const ok = results.filter((r) => r.status < 300);
  const byStatus = {};
  for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;

  const stats = await call(cfg.base, 'GET', `/api/databases/${dbId}`, sessionToken);
  const stored = stats.json && stats.json.data && stats.json.data.database
    && stats.json.data.database.stats ? stats.json.data.database.stats.totalKeys : null;

  console.log(`  requests (each ${batch} cmds): ${batches.length}`);
  console.log(`  wall time        : ${wallSec.toFixed(1)} s (budget ${cfg.budgetSec} s)`);
  console.log(`  ok (2xx)         : ${ok.length} batches -> ${storedInReplies} stored replies`);
  console.log(`  statuses         : ${JSON.stringify(byStatus)}`);
  const lat = latencyStats(ok.map((r) => r.took));
  console.log(`  latency ok  ms   : mean=${num(lat.mean)} p50=${num(lat.p50)} p95=${num(lat.p95)} max=${num(lat.max)} (per batch of ${batch})`);
  console.log(`  stores/second    : ${(storedInReplies / wallSec).toFixed(1)}`);
  console.log(`  stored (stats)   : ${num(stored)}`);
  console.log(`  budget verdict   : ${stored >= cfg.count && wallSec <= cfg.budgetSec ? 'PASS - within 60 s' : 'FAIL'}`);

  await call(cfg.base, 'DELETE', `/api/databases/${dbId}`, sessionToken);
  console.log('  teardown: database deleted (keys cascaded)');

  return { mode: 'pipeline', wallSec, ok: storedInReplies, stored };
}

/* ---------------------------------- main ---------------------------------- */

async function main() {
  const cfg = parseArgs(process.argv);
  console.log(`Cacheify stress test -> ${cfg.base}`);
  console.log(`target: ${cfg.count} stored commands within ${cfg.budgetSec} s | mode=${cfg.mode}`);

  const epoch = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12)
    + Math.random().toString(36).slice(2, 6);
  const phases = [];
  if (cfg.mode === 'single' || cfg.mode === 'all') phases.push(phaseSingle);
  if (cfg.mode === 'pipeline' || cfg.mode === 'all') phases.push(phasePipeline);

  const summary = [];
  for (const phase of phases) {
    try {
      const out = await phase(cfg, epoch);
      if (out) summary.push(out);
    } catch (err) {
      console.log(`  phase ${phase.name} error: ${ascii(err.message)}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  for (const s of summary) {
    console.log(`  ${s.mode.padEnd(8)}: ${s.ok} resources stored in ${s.wallSec.toFixed(1)} s `
      + `(sustained ${(s.ok / s.wallSec).toFixed(0)}/s), verified by stats: ${num(s.stored)}`);
  }
  console.log('\nnote: the per-user data-plane limiter (default 240 req/min) caps SINGLE-request '
    + 'throughput by design; pipeline batches achieve bulk storage within the limit.');
}

main().catch((err) => { console.error(`fatal: ${ascii(err && err.message)}`); process.exit(1); });

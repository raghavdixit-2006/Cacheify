#!/usr/bin/env node
/**
 * Dockerized framework clients.
 * Runs the Java, Go, and Spring Boot clients inside containers against the
 * host platform server, so no JDK/Go/Maven is needed on the host itself.
 * Usage: node tests/clients/run-docker.mjs   (docker desktop must be running)
 *
 - Containers reach the host server on http://host.docker.internal:3000.
 - Images are pulled automatically the first time.
 - The maven local repository and the go build cache live in named volumes,
   so repeat runs skip the dependency downloads.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const HOST_BASE = 'http://host.docker.internal:3000';

function sh(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
}

/* 1. Engine check --------------------------------------------------------- */
const engine = sh('docker', ['version', '--format', '{{.Server.Version}}'], { timeout: 30_000 });
if (engine.status !== 0) {
  console.log('docker engine is not reachable. Start docker desktop and run this again.');
  process.exitCode = 1;
  process.exit(1);
}
console.log(`docker engine ${engine.stdout.trim()} reachable`);

/* 2. Image preparation ---------------------------------------------------- */
function ensureImage(image) {
  const inspect = sh('docker', ['image', 'inspect', image], { timeout: 30_000 });
  if (inspect.status === 0) {
    console.log(`image:  ${image} (cached)`);
    return;
  }
  console.log(`image:  ${image} pulling (first run only)...`);
  const pull = sh('docker', ['pull', '-q', image], { timeout: 600_000 });
  if (pull.status !== 0) {
    console.log(`image pull failed for ${image}`);
    if (pull.stderr) console.log(pull.stderr.trim());
    process.exit(1);
  }
}

const CLIENTS = [
  {
    label: 'Java (JDK HttpClient)',
    image: 'eclipse-temurin:17-alpine',
    run: () => [
      'run', '--rm',
      '-e', `RH_BASE_URL=${HOST_BASE}`,
      '-e', 'RH_EMAIL=qa-review@redishost.test',
      '-v', `${join(here)}:/src`, '-w', '/src',
      'eclipse-temurin:17-alpine',
      'java', 'JavaClient.java',
    ],
  },
  {
    label: 'Go (stdlib net/http)',
    image: 'golang:alpine',
    run: () => [
      'run', '--rm',
      '-e', `RH_BASE_URL=${HOST_BASE}`,
      '-e', 'GOCACHE=/gc',
      '-v', `${join(here)}:/src`, '-w', '/src',
      '-v', 'fw-gocache:/gc',
      'golang:alpine',
      'go', 'run', 'go-client.go',
    ],
  },
  {
    label: 'Spring Boot (RestTemplate)',
    image: 'maven:3.9-eclipse-temurin-17',
    run: () => [
      'run', '--rm',
      '-e', `RH_BASE_URL=${HOST_BASE}`,
      '-v', `${join(here, 'springboot-client')}:/proj`, '-w', '/proj',
      '-v', 'fw-m2:/root/.m2',
      '--entrypoint', 'sh',
      'maven:3.9-eclipse-temurin-17',
      '-c', 'mvn -q -DskipTests package && java -jar target/fw-client.jar --spring.main.web-application-type=none',
    ],
  },
];

const results = [];
for (const client of CLIENTS) {
  console.log('='.repeat(78));
  console.log(`client: ${client.label} (dockerized)`);
  console.log('='.repeat(78));

  ensureImage(client.image);

  const started = Date.now();
  const run = sh('docker', client.run(), { timeout: 600_000 });
  if (run.stdout && run.stdout.trim()) console.log(run.stdout.trimEnd());
  if (run.stderr && run.stderr.trim()) console.log(run.stderr.trimEnd());
  const status = run.status === 0 ? 'PASS' : run.status === null ? 'TIMEOUT' : 'FAIL';
  results.push({ label: client.label, status, ms: Date.now() - started });
}

console.log('='.repeat(78));
console.log('dockerized framework-client matrix');
console.log('-'.repeat(78));
const width = Math.max(...results.map((r) => r.label.length));
for (const r of results) {
  const label = r.label.padEnd(width);
  console.log(`${label}  ${r.status.padEnd(7)}  ${(r.ms / 1000).toFixed(1)} s`);
}
const failed = results.filter((r) => r.status !== 'PASS').length;
console.log('-'.repeat(78));
console.log(`${results.length - failed}/${results.length} dockerized clients passed${failed ? `, ${failed} failed` : ''}.`);
process.exitCode = failed > 0 ? 1 : 0;

#!/usr/bin/env node
/**
 * Runs every framework client against a RUNNING platform server.
 * Usage: node tests/clients/run-all.mjs
 * Each client executes the identical scenario; see README.md in this folder.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const CLIENTS = [
  {
    label: 'Node.js (fetch/undici)',
    cmd: process.execPath, args: ['node-client.mjs'],
  },
  {
    label: 'Python (requests)',
    cmd: 'python', args: ['python-client.py'],
    probe: { cmd: 'python', args: ['-c', 'import requests'] },
    skipNote: 'requests module not installed',
  },
  {
    label: 'PowerShell (Invoke-RestMethod)',
    cmd: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'powershell-client.ps1'],
  },
  {
    label: 'cURL (baseline)',
    cmd: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'curl-client.ps1'],
  },
];

const results = [];
for (const client of CLIENTS) {
  console.log('='.repeat(78));
  console.log(`client: ${client.label}`);
  console.log('='.repeat(78));

  if (client.probe) {
    const probe = spawnSync(client.probe.cmd, client.probe.args, { encoding: 'utf8' });
    if (probe.status !== 0) {
      console.log(`SKIP — ${client.skipNote}`);
      results.push({ label: client.label, status: 'SKIPPED', ms: 0 });
      continue;
    }
  }

  const started = Date.now();
  const run = spawnSync(client.cmd, client.args, {
    cwd: here,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
 });
  if (run.stdout && run.stdout.trim()) console.log(run.stdout.trimEnd());
  if (run.stderr && run.stderr.trim()) console.log(run.stderr.trimEnd());
  const status = run.status === 0 ? 'PASS' : run.status === null ? 'TIMEOUT' : 'FAIL';
  results.push({ label: client.label, status, ms: Date.now() - started });
}

console.log('='.repeat(78));
console.log('framework-client matrix');
console.log('-'.repeat(78));
const width = Math.max(...results.map((r) => r.label.length));
for (const r of results) {
  const label = r.label.padEnd(width);
  const time = r.status === 'SKIPPED' ? '' : `${(r.ms / 1000).toFixed(1)} s`;
  console.log(`${label}  ${r.status.padEnd(7)}  ${time}`);
}
const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL' || r.status === 'TIMEOUT').length;
console.log('-'.repeat(78));
console.log(`${passed}/${results.length} clients passed${failed ? `, ${failed} failed` : ''}.`);
process.exitCode = failed > 0 ? 1 : 0;

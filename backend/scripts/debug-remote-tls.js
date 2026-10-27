#!/usr/bin/env node
'use strict';

/**
 * TEMPORARY TLS diagnostic for the remote Redis connection. Reads the
 * connection string through the server's config loader (never prints it) and
 * reports: TCP reachability, TLS handshake, certificate issuer/hostname/expiry
 * and default-verification outcome. Delete after use.
 */

const net = require('node:net');
const tls = require('node:tls');
const readline = require('node:readline');

const { config } = require('../server/core/env');
const uri = new URL(config.redis.connectionString);
const host = uri.hostname;
const port = Number(uri.port || 6379);
const useTls = uri.protocol.startsWith('rediss') || process.argv.includes('--tls');

function label(name) { return name || '(none)'; }

function connectSocket() {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port, timeout: 8000 });
    socket.once('connect', () => resolve(socket));
    socket.once('timeout', () => socket.destroy(new Error('TCP connect timeout (8s)')));
    socket.once('error', reject);
  });
}

async function main() {
  console.log(`diagnostic target: ${useTls ? 'rediss' : 'redis'}://${host}:${port}/  (credentials not shown)`);
  let socket;
  try {
    socket = await connectSocket();
    console.log('tcp: reachable');
  } catch (err) {
    console.log(`tcp: FAILED - ${err.message}`);
    process.exit(0);
  }

  if (!useTls && !config.redis.tlsCaFile) {
    socket.destroy();
    console.log('plain redis:// scheme; no TLS probe (add rediss:// scheme via .env if the server forces TLS, or pass --tls to probe anyway)');
    process.exit(0);
  }
  if (process.argv.includes('--tls')) {
    console.log('forcing TLS probe per --tls flag');
  }
  if (process.argv.includes('--tls')) {
    console.log('forcing TLS probe per --tls flag');
  }

  // Probe 1: TLS with provider CA when available, else default trust (no bypass).
  const ca = config.redis.tlsCaFile ? require('node:fs').readFileSync(config.redis.tlsCaFile, 'utf8') : undefined;
  const probe = (opts) => new Promise((resolve) => {
    const tlsSocket = tls.connect({ socket, servername: host, ...opts }, () => {
      const cert = tlsSocket.getPeerCertificate(true);
      resolve({
        ok: true,
        issuerCN: label(cert.issuer && cert.issuer.CN),
        subjectCN: label(cert.subject && cert.subject.CN),
        sans: cert.subjectaltname || '(none)',
        validTo: cert.valid_to,
        authorized: tlsSocket.authorized,
      });
      tlsSocket.destroy();
    });
    tlsSocket.once('error', (err) => resolve({ ok: false, reason: `${err.message}` }));
  });

  const result = await probe(ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true });
  if (result.ok) {
    console.log(`tls handshake: OK (authorized=${result.authorized})`);
    console.log(`certificate: subjectCN=${result.subjectCN}, issuerCN=${result.issuerCN}, validTo=${result.validTo}`);
    console.log(`san: ${result.sans}`);
  } else {
    console.log(`tls handshake: FAILED - ${result.reason}`);
  }
  process.exit(0);
}

readline.createInterface(process.stdin).close();
main().catch((err) => {
  console.log(`diagnostic error: ${err.message}`);
  process.exit(0);
});

#!/usr/bin/env node
/**
 * Admin helper for offline bridge recharge vouchers.
 *
 * Examples:
 *   node scripts/offline-recharge-admin.js --request OCZREQ1... --prints 100 --private-key-file C:\Users\Prasham\Documents\OneClickzBridgeOfflineRechargePrivateKey.pem
 *   node scripts/offline-recharge-admin.js --generate-keypair
 */

const crypto = require('crypto');
const fs = require('fs');
const {
  decodeRequest,
  signVoucherPayload,
} = require('../src/license/offlineRecharge');

const args = process.argv.slice(2);

function arg(name, fallback = '') {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : fallback;
}

function has(name) {
  return args.includes(name);
}

function usage(exitCode = 1) {
  console.log(`Usage:
  node scripts/offline-recharge-admin.js --request <OCZREQ1...> [--prints <n>] [--days <n>] --private-key-file <private.pem>
  node scripts/offline-recharge-admin.js --generate-keypair

  --prints <n>   Add n print credits (paper model). Optional.
  --days <n>     Extend the license expiry by n days (license model). Optional.
                 At least one of --prints / --days is required.

Private key can also be supplied through BRIDGE_OFFLINE_RECHARGE_PRIVATE_KEY.
`);
  process.exit(exitCode);
}

if (has('--help') || has('-h')) usage(0);

if (has('--generate-keypair')) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  console.log('PRIVATE KEY - keep this outside the bridge app:');
  console.log(privateKey.export({ type: 'pkcs8', format: 'pem' }));
  console.log('PUBLIC KEY - compile/configure this in the bridge verifier:');
  console.log(publicKey.export({ type: 'spki', format: 'pem' }));
  process.exit(0);
}

const requestCode = arg('--request');
const prints = arg('--prints') ? parseInt(arg('--prints'), 10) : 0;
const days = arg('--days') ? parseInt(arg('--days'), 10) : 0;
const privateKeyFile = arg('--private-key-file');
let privateKeyPem = process.env.BRIDGE_OFFLINE_RECHARGE_PRIVATE_KEY || '';

if (privateKeyFile) {
  privateKeyPem = fs.readFileSync(privateKeyFile, 'utf8');
}

const hasPrints = Number.isFinite(prints) && prints >= 1;
const hasDays = Number.isFinite(days) && days >= 1;
if (!requestCode || !privateKeyPem || (!hasPrints && !hasDays)) {
  usage(1);
}

const request = decodeRequest(requestCode);
if (request.type !== 'bridge-recharge-request') {
  throw new Error('Request code is not a bridge recharge request');
}

const now = Date.now();
const payload = {
  type: 'bridge-offline-recharge',
  voucherId: crypto.randomBytes(12).toString('hex'),
  requestId: request.requestId,
  fingerprint: request.fingerprint,
  licenseKey: request.licenseKey || 'TRIAL',
  issuedAt: new Date(now).toISOString(),
  // The voucher's own validity window (how long the operator has to redeem it).
  expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

if (hasPrints) payload.prints = prints;

if (hasDays) {
  // Absolute new expiry = (later of current expiry / now) + days.
  // Idempotent: re-issuing the same intent yields the same target window.
  const base = Math.max(
    request.currentExpiresAt ? new Date(request.currentExpiresAt).getTime() : 0,
    now
  );
  payload.newExpiresAt = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

console.log(signVoucherPayload(payload, privateKeyPem));

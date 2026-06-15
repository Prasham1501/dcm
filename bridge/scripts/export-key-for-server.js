#!/usr/bin/env node
/**
 * Extracts the 32-byte seed from your Ed25519 PKCS8 private key PEM
 * and prints the hex value to add to your GoDaddy .env file.
 *
 * Usage:
 *   node scripts/export-key-for-server.js --private-key-file "C:\Users\Prasham\Documents\OneClickzBridgeOfflineRechargePrivateKey.pem"
 */
const fs = require('fs');
const args = process.argv.slice(2);
const idx = args.indexOf('--private-key-file');
if (idx < 0 || !args[idx + 1]) {
  console.error('Usage: node export-key-for-server.js --private-key-file <path>');
  process.exit(1);
}
const pem = fs.readFileSync(args[idx + 1], 'utf8');
const der = Buffer.from(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''), 'base64');
// PKCS8 Ed25519: seed is 32 bytes starting at offset 16
const seed = der.slice(16, 48);
if (seed.length !== 32) {
  console.error('Could not extract seed — is this a valid Ed25519 PKCS8 private key?');
  process.exit(1);
}
console.log('\nAdd this line to your GoDaddy .env file:\n');
console.log('BRIDGE_SIGNING_KEY_HEX=' + seed.toString('hex'));
console.log('\nKeep this secret. Do not share or commit it.');

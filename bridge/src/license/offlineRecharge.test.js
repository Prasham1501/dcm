const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const {
  encodeRequest,
  decodeRequest,
  signVoucherPayload,
  verifyVoucher,
  validateRechargePayload,
} = require('./offlineRecharge');

test('request code round-trips payload', () => {
  const payload = {
    type: 'bridge-recharge-request',
    requestId: 'req1',
    fingerprint: 'fp',
    licenseKey: 'MV-TEST',
    requestedPrints: 100,
  };
  assert.deepStrictEqual(decodeRequest(encodeRequest(payload)), payload);
});

test('signed voucher verifies with matching public key', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const payload = {
    type: 'bridge-offline-recharge',
    voucherId: 'v1',
    requestId: 'req1',
    fingerprint: 'fp',
    licenseKey: 'MV-TEST',
    prints: 50,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  };
  const voucher = signVoucherPayload(
    payload,
    privateKey.export({ type: 'pkcs8', format: 'pem' })
  );
  const result = verifyVoucher(
    voucher,
    publicKey.export({ type: 'spki', format: 'pem' })
  );
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.payload, payload);
});

test('tampered voucher is rejected', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const voucher = signVoucherPayload(
    { type: 'bridge-offline-recharge', voucherId: 'v1', prints: 50 },
    privateKey.export({ type: 'pkcs8', format: 'pem' })
  );
  const parts = voucher.split('.');
  parts[1] = parts[1].replace(/.$/, parts[1].endsWith('A') ? 'B' : 'A');
  const result = verifyVoucher(
    parts.join('.'),
    publicKey.export({ type: 'spki', format: 'pem' })
  );
  assert.strictEqual(result.ok, false);
});

// ── validateRechargePayload (stateless checks) ──────────────────────────────

const ID = { fingerprint: 'fp', licenseKey: 'MV-TEST' };
const NOW = Date.UTC(2026, 0, 1);
const FUTURE = new Date(NOW + 90 * 86400000).toISOString();
const base = (over = {}) => ({
  type: 'bridge-offline-recharge',
  voucherId: 'v1', requestId: 'req1',
  fingerprint: 'fp', licenseKey: 'MV-TEST',
  expiresAt: new Date(NOW + 7 * 86400000).toISOString(),
  ...over,
});

test('prints-only voucher is accepted', () => {
  const r = validateRechargePayload(base({ prints: 100 }), { ...ID, now: NOW });
  assert.deepStrictEqual([r.ok, r.prints, r.newExpiresAt], [true, 100, null]);
});

test('days-only voucher (newExpiresAt) is accepted', () => {
  const r = validateRechargePayload(base({ newExpiresAt: FUTURE }), { ...ID, now: NOW });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.prints, 0);
  assert.strictEqual(r.newExpiresAt, FUTURE);
});

test('combined prints + days voucher is accepted', () => {
  const r = validateRechargePayload(base({ prints: 50, newExpiresAt: FUTURE }), { ...ID, now: NOW });
  assert.deepStrictEqual([r.ok, r.prints, r.newExpiresAt], [true, 50, FUTURE]);
});

test('empty voucher (no prints, no days) is rejected', () => {
  assert.strictEqual(validateRechargePayload(base({}), { ...ID, now: NOW }).reason, 'empty_voucher');
});

test('expiry in the past is rejected', () => {
  const past = new Date(NOW - 86400000).toISOString();
  assert.strictEqual(validateRechargePayload(base({ newExpiresAt: past }), { ...ID, now: NOW }).reason, 'expiry_in_past');
});

test('bad print count is rejected', () => {
  assert.strictEqual(validateRechargePayload(base({ prints: 0 }), { ...ID, now: NOW }).reason, 'bad_print_count');
  assert.strictEqual(validateRechargePayload(base({ prints: 2000000 }), { ...ID, now: NOW }).reason, 'bad_print_count');
});

test('wrong device / license is rejected', () => {
  assert.strictEqual(validateRechargePayload(base({ prints: 10, fingerprint: 'other' }), { ...ID, now: NOW }).reason, 'wrong_device');
  assert.strictEqual(validateRechargePayload(base({ prints: 10, licenseKey: 'OTHER' }), { ...ID, now: NOW }).reason, 'wrong_license');
});

test('an expired voucher window is rejected', () => {
  const v = base({ prints: 10, expiresAt: new Date(NOW - 1000).toISOString() });
  assert.strictEqual(validateRechargePayload(v, { ...ID, now: NOW }).reason, 'expired_voucher');
});

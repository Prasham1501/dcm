/**
 * Offline recharge voucher verification.
 *
 * Voucher format:
 *   OCZV1.<base64url-json-payload>.<base64url-ed25519-signature>
 *
 * The bridge verifies with a public key only. The private signing key must stay
 * outside the packaged bridge and is used by the admin generator script.
 */

const crypto = require('crypto');

const DEFAULT_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAiQD3t+UP6ywfDwIBP4lLYGZzYe1xZdfjVgAkphyqWQA=
-----END PUBLIC KEY-----`;

function base64UrlEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(s) {
  const raw = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = raw.length % 4 ? '='.repeat(4 - (raw.length % 4)) : '';
  return Buffer.from(raw + pad, 'base64');
}

function encodePayload(payload) {
  return base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
}

function decodePayload(payload64) {
  return JSON.parse(base64UrlDecode(payload64).toString('utf8'));
}

function getPublicKeyPem() {
  return (process.env.BRIDGE_OFFLINE_RECHARGE_PUBLIC_KEY || DEFAULT_PUBLIC_KEY_PEM).trim();
}

function signVoucherPayload(payload, privateKeyPem) {
  const payload64 = encodePayload(payload);
  const sig = crypto.sign(null, Buffer.from(payload64, 'utf8'), privateKeyPem);
  return `OCZV1.${payload64}.${base64UrlEncode(sig)}`;
}

function verifyVoucher(voucher, publicKeyPem = getPublicKeyPem()) {
  const parts = String(voucher || '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'OCZV1') {
    return { ok: false, reason: 'bad_format' };
  }

  const [, payload64, sig64] = parts;
  let payload;
  try {
    payload = decodePayload(payload64);
  } catch {
    return { ok: false, reason: 'bad_payload' };
  }

  let valid = false;
  try {
    valid = crypto.verify(null, Buffer.from(payload64, 'utf8'), publicKeyPem, base64UrlDecode(sig64));
  } catch {
    return { ok: false, reason: 'bad_public_key' };
  }

  if (!valid) return { ok: false, reason: 'bad_signature' };
  return { ok: true, payload };
}

/**
 * Stateless validation of a verified voucher payload.
 *
 * Checks everything that does NOT need on-disk / in-memory state (replay list,
 * challenge map): voucher type, that it carries at least one of prints/days,
 * amount bounds, the new license expiry is a real future date, the voucher's
 * own validity window, and that it is bound to THIS device + license.
 *
 * Stateful checks (challenge requestId exists, voucherId not already redeemed)
 * stay in the caller. Returns the normalised { prints, newExpiresAt } to apply.
 */
function validateRechargePayload(payload, { fingerprint, licenseKey, now = Date.now() } = {}) {
  const p = payload || {};
  if (p.type !== 'bridge-offline-recharge') return { ok: false, reason: 'wrong_type' };
  if (!p.voucherId || !p.requestId) return { ok: false, reason: 'missing_id' };

  let prints = 0;
  if (p.prints !== undefined && p.prints !== null && p.prints !== '') {
    prints = Math.floor(Number(p.prints));
    if (!Number.isFinite(prints) || prints < 1 || prints > 1000000) {
      return { ok: false, reason: 'bad_print_count' };
    }
  }

  let newExpiresAt = null;
  if (p.newExpiresAt) {
    const t = new Date(p.newExpiresAt).getTime();
    if (!Number.isFinite(t)) return { ok: false, reason: 'bad_expiry' };
    if (t <= now) return { ok: false, reason: 'expiry_in_past' };
    newExpiresAt = new Date(t).toISOString();
  }

  // A voucher must grant something — prints, days, or both.
  if (!prints && !newExpiresAt) return { ok: false, reason: 'empty_voucher' };

  // The voucher's own validity window (separate from the license expiry it grants).
  if (p.expiresAt && new Date(p.expiresAt).getTime() < now) {
    return { ok: false, reason: 'expired_voucher' };
  }

  // Device + license binding — a voucher minted for one bridge can't be used on another.
  if (p.fingerprint !== fingerprint) return { ok: false, reason: 'wrong_device' };
  if ((p.licenseKey || 'TRIAL') !== (licenseKey || 'TRIAL')) return { ok: false, reason: 'wrong_license' };

  return { ok: true, prints, newExpiresAt };
}

function encodeRequest(payload) {
  return `OCZREQ1.${encodePayload(payload)}`;
}

function decodeRequest(requestCode) {
  const parts = String(requestCode || '').trim().split('.');
  if (parts.length !== 2 || parts[0] !== 'OCZREQ1') {
    throw new Error('Invalid request code');
  }
  return decodePayload(parts[1]);
}

module.exports = {
  DEFAULT_PUBLIC_KEY_PEM,
  base64UrlEncode,
  base64UrlDecode,
  encodeRequest,
  decodeRequest,
  signVoucherPayload,
  verifyVoucher,
  validateRechargePayload,
};

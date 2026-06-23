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

// ---------------------------------------------------------------------------
// Short, phone-friendly voucher codes (HMAC-based, for offline machines).
//
// A 7-char Request code is derived from the device fingerprint + a rotating
// counter; the 12-char Voucher code carries prints + days + a 24-bit MAC that
// binds it to that exact request code. Both sides share a single secret
// (embedded in the bridge to verify, set in the website env to generate).
// Crockford base32 alphabet (no I/L/O/U) avoids transcription mistakes.
// ---------------------------------------------------------------------------
const SHORT_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function shortBase32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) { out += SHORT_ALPHABET[(value >> (bits - 5)) & 31]; bits -= 5; }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += SHORT_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function shortBase32Decode(str) {
  const clean = String(str || '').toUpperCase()
    .replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V')
    .replace(/[^0-9A-Z]/g, '');
  let bits = 0, value = 0; const out = [];
  for (const ch of clean) {
    const idx = SHORT_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >> (bits - 8)) & 0xff); bits -= 8; value &= (1 << bits) - 1; }
  }
  return Buffer.from(out);
}

function shortHmac(secret, msg) {
  return crypto.createHmac('sha256', Buffer.from(String(secret), 'utf8')).update(String(msg), 'utf8').digest();
}

function clampShortInt(n, lo, hi) { n = Math.floor(Number(n) || 0); return Math.max(lo, Math.min(hi, n)); }

/** 7-char request code from device fingerprint + rotating counter. */
function shortRequestCode(secret, fingerprint, counter) {
  return shortBase32Encode(shortHmac(secret, `req|${fingerprint}|${counter}`)).slice(0, 7);
}

/** 12-char voucher: prints (u16) + days (≤4095) + 24-bit MAC bound to requestCode. */
function makeShortVoucher(secret, requestCode, prints, days) {
  const p = clampShortInt(prints, 0, 65535);
  const d = clampShortInt(days, 0, 4095);
  const payload = Buffer.alloc(4);
  payload.writeUInt16BE(p, 0);
  payload.writeUInt16BE(d, 2);
  const mac = shortHmac(secret, `vch|${requestCode}|${p}|${d}`).subarray(0, 3);
  return shortBase32Encode(Buffer.concat([payload, mac]));
}

/** Verify a short voucher against the device's current request code. */
function verifyShortVoucher(secret, requestCode, voucher) {
  const bytes = shortBase32Decode(voucher);
  if (!bytes || bytes.length < 7) return { ok: false, reason: 'bad_format' };
  const prints = bytes.readUInt16BE(0);
  const days = bytes.readUInt16BE(2);
  const mac = bytes.subarray(4, 7);
  const expected = shortHmac(secret, `vch|${requestCode}|${prints}|${days}`).subarray(0, 3);
  if (mac.length !== 3 || !crypto.timingSafeEqual(mac, expected)) return { ok: false, reason: 'invalid_code' };
  if (prints === 0 && days === 0) return { ok: false, reason: 'empty_voucher' };
  return { ok: true, prints, days };
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
  // short HMAC voucher codec
  shortBase32Encode,
  shortBase32Decode,
  shortRequestCode,
  makeShortVoucher,
  verifyShortVoucher,
};

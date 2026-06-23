/**
 * Short offline voucher codec for the Viewer (main process).
 * Byte-for-byte identical to bridge/src/license/offlineRecharge.js and the
 * website generator (website/bridge-voucher.php), so one generator serves both
 * apps. Crockford base32 (no I/L/O/U) + HMAC-SHA256.
 */
const crypto = require('crypto');

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

function shortRequestCode(secret, fingerprint, counter) {
  return shortBase32Encode(shortHmac(secret, `req|${fingerprint}|${counter}`)).slice(0, 7);
}

function makeShortVoucher(secret, requestCode, prints, days) {
  const p = clampShortInt(prints, 0, 65535);
  const d = clampShortInt(days, 0, 4095);
  const payload = Buffer.alloc(4);
  payload.writeUInt16BE(p, 0);
  payload.writeUInt16BE(d, 2);
  const mac = shortHmac(secret, `vch|${requestCode}|${p}|${d}`).subarray(0, 3);
  return shortBase32Encode(Buffer.concat([payload, mac]));
}

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

module.exports = { shortBase32Encode, shortBase32Decode, shortRequestCode, makeShortVoucher, verifyShortVoucher };

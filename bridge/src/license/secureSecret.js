/**
 * secureSecret.js — assembles the voucher secret at runtime so it is NOT a
 * greppable literal in the packaged .asar. This is obfuscation, not real
 * protection against a debugger; it defeats `strings`/asar-extract grep and
 * raises the bar from "trivial plaintext" to "needs runtime reverse-engineering".
 *
 * Byte-identical to the Viewer's secureSecret.js at the repo root.
 * Re-generate both together with the build helper if the secret is rotated.
 *
 * Layout (32 raw secret bytes split + XOR-masked):
 *   secretBytes[0..15]  = chunkA XOR masks[0..15]
 *   secretBytes[16..31] = chunkB XOR masks[16..31]
 * The returned base64 string is the same form the codec already consumes.
 */
module.exports = function secret() {
  const a = Buffer.from('7pjPrMRimV0Y/g2PzaEo1Q==', 'base64');
  const b = Buffer.from('R4y1e1qRQZJkP6ZGb9ClfA==', 'base64');
  const m = Buffer.from('BV5XwpgEEdBbTUkjERO+AidjL7+SeDG1cBOme3/m6l8=', 'base64');
  const out = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) out[i] = (i < 16 ? a[i] : b[i - 16]) ^ m[i];
  return out.toString('base64');
};

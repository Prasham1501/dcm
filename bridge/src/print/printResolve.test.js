const test = require('node:test');
const assert = require('node:assert');
const { resolveTargetPaper, resolveBranding, resolveLut } = require('./printResolve');

test('mapped film size converts to its target paper', () => {
  assert.strictEqual(resolveTargetPaper({ paperSize: 'A4', filmSizeMap: { '14INX17IN': 'A5' } }, '14INX17IN'), 'A5');
});

test('film id matching is case/space-insensitive', () => {
  assert.strictEqual(resolveTargetPaper({ paperSize: 'A4', filmSizeMap: { '14INX17IN': 'B4JIS' } }, ' 14inx17in '), 'B4JIS');
});

test('SAME keeps the literal film size when known', () => {
  assert.strictEqual(resolveTargetPaper({ paperSize: 'A4', filmSizeMap: { '14INX17IN': 'SAME' } }, '14INX17IN'), '14INX17IN');
});

test('SAME on an unknown film id falls back to the slot default', () => {
  assert.strictEqual(resolveTargetPaper({ paperSize: 'A5', filmSizeMap: { WEIRD: 'SAME' } }, 'WEIRD'), 'A5');
});

test('unmapped film size uses the slot default paper', () => {
  assert.strictEqual(resolveTargetPaper({ paperSize: 'B5JIS', filmSizeMap: {} }, '8INX10IN'), 'B5JIS');
});

test('missing filmSizeMap uses the slot default paper', () => {
  assert.strictEqual(resolveTargetPaper({ paperSize: 'A4' }, '8INX10IN'), 'A4');
});

test('resolveBranding picks the slot brandingId', () => {
  const config = { brandings: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], defaultBrandingId: 'a' };
  assert.strictEqual(resolveBranding(config, { brandingId: 'b' }).id, 'b');
});

test('resolveBranding falls back to default then first then legacy', () => {
  const config = { brandings: [{ id: 'a' }, { id: 'b' }], defaultBrandingId: 'b' };
  assert.strictEqual(resolveBranding(config, { brandingId: null }).id, 'b');
  assert.strictEqual(resolveBranding(config, { brandingId: 'missing' }).id, 'b');
  assert.strictEqual(resolveBranding({ brandings: [{ id: 'x' }] }, { brandingId: 'nope' }).id, 'x');
  assert.strictEqual(resolveBranding({ branding: { id: 'legacy' } }, {}).id, 'legacy');
});

test('resolveLut: disabled / missing / no-op gamma → not enabled', () => {
  assert.strictEqual(resolveLut(undefined).enabled, false);
  assert.strictEqual(resolveLut({ lutEnabled: false, lutGamma: 2 }).enabled, false);
  assert.strictEqual(resolveLut({ lutEnabled: true, lutGamma: 1 }).enabled, false);
  assert.strictEqual(resolveLut({ lutEnabled: true }).enabled, false); // gamma undefined → 1 → no-op
});

test('resolveLut: enabled gamma passes through, clamped to [0.3, 3]', () => {
  assert.deepStrictEqual(resolveLut({ lutEnabled: true, lutGamma: 2.2 }), { enabled: true, gamma: 2.2 });
  assert.deepStrictEqual(resolveLut({ lutEnabled: true, lutGamma: 0.6 }), { enabled: true, gamma: 0.6 });
  assert.strictEqual(resolveLut({ lutEnabled: true, lutGamma: 99 }).gamma, 3);
  assert.strictEqual(resolveLut({ lutEnabled: true, lutGamma: 0.01 }).gamma, 0.3);
});

const test = require('node:test');
const assert = require('node:assert');
const { defaultConfig, defaultSlot, validateSlot, migrateConfig } = require('./schema');

test('defaultConfig is v7 with one default branding', () => {
  const c = defaultConfig();
  assert.strictEqual(c.version, 7);
  assert.strictEqual(c.brandings.length, 1);
  assert.strictEqual(c.brandings[0].id, c.defaultBrandingId);
  assert.strictEqual(c.brandings[0].name, 'Default');
  assert.strictEqual(c.branding, undefined);
});

test('defaultSlot has filmSizeMap, brandingId=null, paperSize A4, and validates', () => {
  const s = defaultSlot(1);
  assert.deepStrictEqual(s.filmSizeMap, {});
  assert.strictEqual(s.brandingId, null);
  assert.strictEqual(s.paperSize, 'A4');
  assert.deepStrictEqual(validateSlot(s), []);
});

test('validateSlot rejects dropped paper sizes and bad map targets', () => {
  const s = defaultSlot(1);
  assert.ok(validateSlot({ ...s, paperSize: 'A3' }).length > 0);
  assert.ok(validateSlot({ ...s, paperSize: 'Letter' }).length > 0);
  assert.ok(validateSlot({ ...s, filmSizeMap: { X: 'Letter' } }).length > 0);
  assert.deepStrictEqual(validateSlot({ ...s, filmSizeMap: { '14INX17IN': 'SAME', '8INX10IN': 'B4JIS' } }), []);
});

test('migrate v6 → v7: single branding becomes brandings[], slots seeded, A3 → A4', () => {
  const old = {
    version: 6,
    slots: [{
      id: 's1', name: 'P1', enabled: true, aeTitle: 'MVBRIDGE_P1', bindHost: '0.0.0.0',
      port: 7001, windowsPrinterName: '', paperSize: 'A3', layoutId: 'auto',
      studyDebounceSeconds: 5, copies: 1, quotaEnabled: false, quotaRemaining: 0, quotaTotal: 0,
    }],
    branding: { hospitalName: 'Test Hospital', headerNameColor: '#123456' },
  };
  // Mirror ConfigStore._load: defaults supply brandings, the parsed file supplies branding.
  const merged = { ...defaultConfig(), ...old };
  const m = migrateConfig(merged);

  assert.strictEqual(m.version, 7);
  assert.strictEqual(m.brandings.length, 1);
  assert.strictEqual(m.brandings[0].name, 'Default');
  assert.strictEqual(m.brandings[0].hospitalName, 'Test Hospital');
  assert.strictEqual(m.brandings[0].headerNameColor, '#123456');
  assert.strictEqual(m.brandings[0].id, m.defaultBrandingId);
  assert.strictEqual(m.branding, undefined);

  assert.deepStrictEqual(m.slots[0].filmSizeMap, {});
  assert.strictEqual(m.slots[0].brandingId, null);
  assert.strictEqual(m.slots[0].paperSize, 'A4'); // A3 was dropped → A4
});

test('migrate is idempotent on an already-v7 config', () => {
  const c = migrateConfig(defaultConfig());
  const again = migrateConfig(JSON.parse(JSON.stringify(c)));
  assert.strictEqual(again.version, 7);
  assert.strictEqual(again.brandings.length, 1);
  assert.strictEqual(again.defaultBrandingId, c.defaultBrandingId);
});

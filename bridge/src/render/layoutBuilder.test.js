const test = require('node:test');
const assert = require('node:assert');
const { buildPrintHtml } = require('./layoutBuilder');

const baseArgs = (paperSize, branding) => ({
  slot: { name: 'P1', aeTitle: 'AE', paperSize, layoutId: 'auto' },
  images: ['file:///x.png'],
  metadata: {},
  branding: branding || null,
});

test('A4 emits a named @page size', () => {
  const html = buildPrintHtml(baseArgs('A4'));
  assert.match(html, /size:\s*A4 (portrait|landscape)/);
});

test('B4JIS emits explicit mm @page size (257 × 364)', () => {
  const html = buildPrintHtml(baseArgs('B4JIS'));
  assert.match(html, /size:\s*257mm 364mm/);
});

test('ENV10 emits explicit mm @page size (104.8 × 241.3)', () => {
  const html = buildPrintHtml(baseArgs('ENV10'));
  assert.match(html, /size:\s*104\.8mm 241\.3mm/);
});

test('branding header appears when hospitalName is set', () => {
  const html = buildPrintHtml(baseArgs('A4', { hospitalName: 'My Clinic', enableFooter: false }));
  assert.match(html, /My Clinic/);
});

test('pageSizeOverride wins over slot.paperSize', () => {
  const args = baseArgs('A4');
  args.pageSizeOverride = 'A5';
  const html = buildPrintHtml(args);
  assert.match(html, /size:\s*A5 (portrait|landscape)/);
});

test('no LUT filter when lut is absent or disabled', () => {
  assert.doesNotMatch(buildPrintHtml(baseArgs('A4')), /oc-lut/);
  const args = baseArgs('A4');
  args.lut = { enabled: false, gamma: 1 };
  assert.doesNotMatch(buildPrintHtml(args), /oc-lut/);
});

test('LUT emits an SVG gamma filter and applies it to images', () => {
  const args = baseArgs('A4');
  args.lut = { enabled: true, gamma: 2.2 };
  const html = buildPrintHtml(args);
  assert.match(html, /filter id="oc-lut"/);
  assert.match(html, /type="gamma" amplitude="1" exponent="2\.2"/);
  assert.match(html, /filter:url\(#oc-lut\)/);
});

test('LUT gamma of 1 is treated as a no-op (no filter)', () => {
  const args = baseArgs('A4');
  args.lut = { enabled: true, gamma: 1 };
  assert.doesNotMatch(buildPrintHtml(args), /oc-lut/);
});

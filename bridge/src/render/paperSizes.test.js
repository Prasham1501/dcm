const test = require('node:test');
const assert = require('node:assert');
const ps = require('./paperSizes');

test('exactly the 8 selectable papers, each with dims + label + win code', () => {
  assert.strictEqual(ps.SELECTABLE_PAPER_IDS.length, 8);
  for (const id of ps.SELECTABLE_PAPER_IDS) {
    assert.ok(ps.PAPER_DIMS_MM[id], `dims for ${id}`);
    assert.ok(ps.PAPER_LABELS[id], `label for ${id}`);
    assert.ok(ps.WIN_PAPER_CODES[id], `win code for ${id}`);
  }
});

test('windows DMPAPER codes match the user spec', () => {
  assert.deepStrictEqual(ps.WIN_PAPER_CODES, {
    A4: 9, A5: 11, B4JIS: 12, B5JIS: 13, ENV9: 19, ENV10: 20, CSHEET: 24, DSHEET: 25,
  });
});

test('A4/A5 are electron-named; the rest return explicit microns', () => {
  assert.strictEqual(ps.isNamedSize('A4'), true);
  assert.strictEqual(ps.isNamedSize('A5'), true);
  assert.strictEqual(ps.isNamedSize('B4JIS'), false);
  assert.strictEqual(ps.electronPageSize('A4'), 'A4');
  assert.deepStrictEqual(ps.electronPageSize('B4JIS'), { width: 257000, height: 364000 });
  assert.deepStrictEqual(ps.electronPageSize('ENV10'), { width: 104800, height: 241300 });
  assert.deepStrictEqual(ps.electronPageSize('ENV10', true), { width: 241300, height: 104800 });
  assert.deepStrictEqual(ps.electronPageSize('DSHEET'), { width: 558800, height: 863600 });
});

test('printToPDF custom page sizes are expressed in inches', () => {
  assert.strictEqual(ps.pdfPageSize('A5'), 'A5');
  assert.deepStrictEqual(ps.pdfPageSize('ENV10'), { width: 4.126, height: 9.5 });
  assert.deepStrictEqual(ps.pdfPageSize('ENV10', true), { width: 9.5, height: 4.126 });
});

test('unknown size falls back to A4', () => {
  assert.strictEqual(ps.electronPageSize('NOPE'), 'A4');
  assert.strictEqual(ps.pdfPageSize('NOPE'), 'A4');
});

test('DICOM film sources are still known for "Same as film"', () => {
  assert.ok(ps.PAPER_DIMS_MM['14INX17IN']);
  assert.ok(ps.PAPER_DIMS_MM['24CMX30CM']);
});

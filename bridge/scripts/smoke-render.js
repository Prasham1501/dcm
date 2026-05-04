/**
 * Standalone render smoke test.
 * Usage: node scripts/smoke-render.js <dcm-file-or-dir> [outDir]
 *
 * Reads each .dcm file with the production renderer (../src/render/dicomRender)
 * and writes a PNG next to it in outDir (default: ./render-test/).
 */

const fs = require('fs');
const path = require('path');
const { renderToPng, readMetadata } = require('../src/render/dicomRender');

const inArg = process.argv[2];
if (!inArg) {
  console.error('Usage: node scripts/smoke-render.js <dcm-file-or-dir> [outDir]');
  process.exit(1);
}

const outDir = process.argv[3] || path.join(__dirname, '..', 'render-test');
fs.mkdirSync(outDir, { recursive: true });

const stats = fs.statSync(inArg);
const files = stats.isDirectory()
  ? fs.readdirSync(inArg).filter((f) => f.toLowerCase().endsWith('.dcm')).map((f) => path.join(inArg, f))
  : [inArg];

const logger = {
  debug: (m) => console.log('  [debug]', m),
  info:  (m) => console.log('  [info]', m),
  warn:  (m) => console.warn('  [warn]', m),
  error: (m) => console.error('  [error]', m),
};

let ok = 0, fail = 0;
for (const f of files) {
  console.log(`\n→ ${path.basename(f)}`);
  try {
    const meta = readMetadata(f);
    console.log(`  modality=${meta.modality} patient=${meta.patientName} ts=${meta.transferSyntax}`);
    const dataUrl = renderToPng(f, logger);
    if (!dataUrl) { console.error('  null output — skipped'); fail++; continue; }
    const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const out = path.join(outDir, path.basename(f, '.dcm') + '.png');
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    const size = fs.statSync(out).size;
    console.log(`  ✓ ${out} (${(size / 1024).toFixed(1)} KB)`);
    ok++;
  } catch (e) {
    console.error(`  ✗ ${e.stack || e.message}`);
    fail++;
  }
}

console.log(`\n${ok} ok, ${fail} failed → ${outDir}`);

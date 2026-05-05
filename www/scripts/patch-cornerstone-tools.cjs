/**
 * Patches cornerstone-tools drawLinkedTextBox to support per-annotation text hiding.
 * Run after npm install: node scripts/patch-cornerstone-tools.js
 * 
 * Adds a check for textBox._hidden flag at the start of drawLinkedTextBox.
 * When _hidden is true, the text box and its connecting line are not drawn.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', 'cornerstone-tools', 'dist', 'cornerstoneTools.js');

if (!fs.existsSync(filePath)) {
  console.log('[patch] cornerstone-tools dist not found, skipping.');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf-8');

const MARKER = 'if (textBox && textBox._hidden) return;';
if (content.includes(MARKER)) {
  console.log('[patch] cornerstone-tools already patched.');
  // Still check if Vite cache needs clearing
  const viteCacheFile = path.join(__dirname, '..', 'node_modules', '.vite', 'deps', 'cornerstone-tools.js');
  if (fs.existsSync(viteCacheFile)) {
    const cached = fs.readFileSync(viteCacheFile, 'utf-8');
    if (!cached.includes(MARKER)) {
      const viteCacheDir = path.join(__dirname, '..', 'node_modules', '.vite');
      fs.rmSync(viteCacheDir, { recursive: true, force: true });
      console.log('[patch] Cleared stale Vite dependency cache.');
    }
  }
  process.exit(0);
}

const TARGET = '/* harmony default export */ __webpack_exports__["default"] = (function (context, element, textBox, text, handles, textBoxAnchorPoints, color, lineWidth, xOffset, yCenter) {\n  var pixelToCanvas';
const REPLACEMENT = '/* harmony default export */ __webpack_exports__["default"] = (function (context, element, textBox, text, handles, textBoxAnchorPoints, color, lineWidth, xOffset, yCenter) {\n  if (textBox && textBox._hidden) return;\n  var pixelToCanvas';

if (!content.includes(TARGET)) {
  console.log('[patch] Could not find drawLinkedTextBox target in cornerstone-tools. Manual patch may be needed.');
  process.exit(1);
}

content = content.replace(TARGET, REPLACEMENT);
fs.writeFileSync(filePath, content, 'utf-8');
console.log('[patch] cornerstone-tools drawLinkedTextBox patched successfully.');

// Clear Vite dependency cache so it re-bundles with the patch
const viteCacheDir = path.join(__dirname, '..', 'node_modules', '.vite');
if (fs.existsSync(viteCacheDir)) {
  fs.rmSync(viteCacheDir, { recursive: true, force: true });
  console.log('[patch] Cleared Vite dependency cache.');
}

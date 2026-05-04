/**
 * Build a self-contained HTML page that lays out N DICOM image data URLs
 * into the slot's chosen grid using fixed print-page coordinates.
 */

const { resolveLayoutForJob, getLayoutGridTemplate, getLayoutAreaNames } = require('./layoutUtils');

const PAPER_DIMS_MM = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  A5: { w: 148, h: 210 },
  Letter: { w: 215.9, h: 279.4 },
  Legal: { w: 215.9, h: 355.6 },
};

const PAGE_MARGIN_MM = 5;
const HEADER_HEIGHT_MM = 7;
const FOOTER_HEIGHT_MM = 7;
const SECTION_GAP_MM = 2;
const SLOT_GAP_MM = 1;

function chunkPages(images, spotsPerPage) {
  const pages = [];
  for (let i = 0; i < images.length; i += spotsPerPage) {
    pages.push(images.slice(i, i + spotsPerPage));
  }
  if (pages.length === 0) pages.push([]);
  return pages;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseTrackFractions(template, count) {
  const repeatMatch = String(template || '').match(/^repeat\((\d+),\s*([\d.]+)fr\)$/);
  if (repeatMatch) {
    return Array.from({ length: parseInt(repeatMatch[1], 10) || count }, () => parseFloat(repeatMatch[2]) || 1);
  }

  const parts = String(template || '')
    .split(/\s+/)
    .map((part) => {
      const match = part.match(/^([\d.]+)fr$/);
      return match ? parseFloat(match[1]) || 1 : 1;
    })
    .filter((value) => Number.isFinite(value) && value > 0);

  if (parts.length === count) return parts;
  return Array.from({ length: count }, () => 1);
}

function cumulativeFractions(fractions) {
  const total = fractions.reduce((sum, value) => sum + value, 0) || 1;
  const edges = [0];
  let acc = 0;
  for (const value of fractions) {
    acc += value;
    edges.push((acc / total) * 100);
  }
  return edges;
}

function parseAreaMatrix(areas) {
  if (!areas) return [];
  const rows = [];
  const rowRegex = /"([^"]+)"/g;
  let match;
  while ((match = rowRegex.exec(areas)) !== null) {
    rows.push(match[1].trim().split(/\s+/));
  }
  return rows;
}

function getSlotRects(layout, grid) {
  const colEdges = cumulativeFractions(parseTrackFractions(grid.columns, layout.cols));
  const rowEdges = cumulativeFractions(parseTrackFractions(grid.rows, layout.rows));
  const matrix = parseAreaMatrix(layout.areas);
  const areaNames = getLayoutAreaNames(layout.areas);

  if (matrix.length && areaNames.length) {
    return areaNames.map((name) => {
      let minRow = Infinity;
      let maxRow = -1;
      let minCol = Infinity;
      let maxCol = -1;
      matrix.forEach((row, rowIdx) => {
        row.forEach((cell, colIdx) => {
          if (cell === name) {
            minRow = Math.min(minRow, rowIdx);
            maxRow = Math.max(maxRow, rowIdx);
            minCol = Math.min(minCol, colIdx);
            maxCol = Math.max(maxCol, colIdx);
          }
        });
      });
      return {
        left: colEdges[minCol] || 0,
        top: rowEdges[minRow] || 0,
        width: (colEdges[maxCol + 1] || 100) - (colEdges[minCol] || 0),
        height: (rowEdges[maxRow + 1] || 100) - (rowEdges[minRow] || 0),
      };
    });
  }

  return Array.from({ length: layout.spots }, (_, idx) => {
    const row = Math.floor(idx / layout.cols);
    const col = idx % layout.cols;
    return {
      left: colEdges[col] || 0,
      top: rowEdges[row] || 0,
      width: (colEdges[col + 1] || 100) - (colEdges[col] || 0),
      height: (rowEdges[row + 1] || 100) - (rowEdges[row] || 0),
    };
  });
}

function buildPrintHtml({ slot, images, metadata }) {
  const { layout, orientation } = resolveLayoutForJob(slot.layoutId, images.length);
  const grid = getLayoutGridTemplate(layout);
  const slotRects = getSlotRects(layout, grid);
  const pages = chunkPages(images, layout.spots);
  const dims = PAPER_DIMS_MM[slot.paperSize] || PAPER_DIMS_MM.A4;
  const w = orientation === 'landscape' ? dims.h : dims.w;
  const h = orientation === 'landscape' ? dims.w : dims.h;

  const headerText = [
    metadata.patientName ? `Patient: ${escapeHtml(metadata.patientName)}` : '',
    metadata.patientId ? `ID: ${escapeHtml(metadata.patientId)}` : '',
    metadata.studyDate ? `Date: ${escapeHtml(metadata.studyDate)}` : '',
    metadata.modality ? `Modality: ${escapeHtml(metadata.modality)}` : '',
  ].filter(Boolean).join(' - ');

  const headerBlock = headerText ? HEADER_HEIGHT_MM + SECTION_GAP_MM : 0;
  const footerBlock = FOOTER_HEIGHT_MM + SECTION_GAP_MM;
  const gridLeft = PAGE_MARGIN_MM;
  const gridTop = PAGE_MARGIN_MM + headerBlock;
  const gridW = w - PAGE_MARGIN_MM * 2;
  const gridH = h - PAGE_MARGIN_MM * 2 - headerBlock - footerBlock;
  const footerTop = h - PAGE_MARGIN_MM - FOOTER_HEIGHT_MM;

  const pageHtml = pages.map((page, pageIdx) => {
    const slotsHtml = Array.from({ length: layout.spots }, (_, idx) => {
      const src = page[idx];
      const rect = slotRects[idx] || { left: 0, top: 0, width: 100, height: 100 };
      const left = gridLeft + (rect.left / 100) * gridW + SLOT_GAP_MM / 2;
      const top = gridTop + (rect.top / 100) * gridH + SLOT_GAP_MM / 2;
      const width = (rect.width / 100) * gridW - SLOT_GAP_MM;
      const height = (rect.height / 100) * gridH - SLOT_GAP_MM;
      const style = [
        `left:${left.toFixed(3)}mm`,
        `top:${top.toFixed(3)}mm`,
        `width:${Math.max(1, width).toFixed(3)}mm`,
        `height:${Math.max(1, height).toFixed(3)}mm`,
      ].join(';');
      return `
        <div class="slot" style="${style}">
          ${src ? `<img src="${src}" alt="img-${pageIdx}-${idx}" />` : ''}
        </div>
      `;
    }).join('');

    return `
      <section class="page">
        ${headerText ? `<header class="hdr">${headerText}</header>` : ''}
        ${slotsHtml}
        <footer class="ftr">Accurate Bridge - Slot: ${escapeHtml(slot.name)} - ${escapeHtml(slot.aeTitle)} - Layout: ${escapeHtml(layout.id)} - Page ${pageIdx + 1} / ${pages.length}</footer>
      </section>
    `;
  }).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>print-${slot.name}</title>
  <style>
    @page {
      size: ${slot.paperSize} ${orientation};
      margin: 0;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: white; color: black; font-family: 'Segoe UI', Inter, Arial, sans-serif; }
    .page {
      position: relative;
      width: ${w}mm;
      height: ${h}mm;
      page-break-after: always;
      overflow: hidden;
    }
    .page:last-child { page-break-after: auto; }
    .hdr {
      position: absolute;
      left: ${PAGE_MARGIN_MM}mm;
      top: ${PAGE_MARGIN_MM}mm;
      width: ${gridW}mm;
      height: ${HEADER_HEIGHT_MM}mm;
      font-size: 9pt;
      border-bottom: 0.3mm solid #888;
      overflow: hidden;
      white-space: nowrap;
    }
    .ftr {
      position: absolute;
      left: ${PAGE_MARGIN_MM}mm;
      top: ${footerTop}mm;
      width: ${gridW}mm;
      height: ${FOOTER_HEIGHT_MM}mm;
      font-size: 7pt;
      color: #555;
      border-top: 0.3mm solid #888;
      text-align: center;
      overflow: hidden;
      white-space: nowrap;
    }
    .slot {
      position: absolute;
      background: #000;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .slot img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  </style>
</head>
<body>
  ${pageHtml}
</body>
</html>`;
}

module.exports = { buildPrintHtml, chunkPages, PAPER_DIMS_MM, PAGE_MARGIN_MM, getSlotRects };

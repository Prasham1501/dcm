import type { Reading } from '../types';
import { parseTextBlock } from '../parseUsgText';

/** Grab the rendered canvas for each imageUrl via cornerstone and run Tesseract OCR on it. */
export async function fromPixelOcr(
  imageUrls: string[]
): Promise<{ readings: Reading[]; warnings: string[] }> {
  const warnings: string[] = [];

  // Dynamically import Tesseract to avoid bundling it unless needed
  let createWorker: any;
  try {
    const tesseract = await import('tesseract.js');
    createWorker = tesseract.createWorker;
  } catch {
    warnings.push('Tesseract.js not installed — OCR unavailable. Run: npm install tesseract.js');
    return { readings: [], warnings };
  }

  // Collect canvases from already-rendered cornerstone elements
  const canvasDataUrls: string[] = [];
  try {
    const cornerstone = (window as any).__cornerstone ?? (window as any).cornerstone;
    if (!cornerstone) {
      warnings.push('Cornerstone not available for OCR canvas capture');
      return { readings: [], warnings };
    }

    // Support both main viewer ([data-viewport-index]) and CR viewer ([data-cr-viewport-index])
    const elements = document.querySelectorAll('[data-viewport-index], [data-cr-viewport-index]');
    for (const el of Array.from(elements)) {
      try {
        const enabled = cornerstone.getEnabledElement(el as HTMLElement);
        if (!enabled?.canvas) continue;
        // Crop to overlay regions: top strip (20%), bottom strip (20%), exclude center
        canvasDataUrls.push(...cropOverlayRegions(enabled.canvas));
      } catch {
        // element not yet enabled, skip
      }
    }
  } catch (err: any) {
    warnings.push(`Canvas capture failed: ${err?.message}`);
    return { readings: [], warnings };
  }

  if (canvasDataUrls.length === 0) {
    warnings.push('No rendered viewports found for OCR');
    return { readings: [], warnings };
  }

  // Run Tesseract on each cropped region
  let worker: any;
  try {
    worker = await createWorker('eng', 1, {
      logger: () => {}, // suppress progress logs
    });
    // PSM 11 = sparse text — finds as much text as possible without assuming layout
    await worker.setParameters({ tessedit_pageseg_mode: '11' });

    const allText: string[] = [];
    for (const dataUrl of canvasDataUrls.slice(0, 10)) { // cap at 10 crops
      try {
        const { data } = await worker.recognize(dataUrl);
        if (data.text?.trim()) allText.push(data.text);
      } catch {
        // skip failed crop
      }
    }

    await worker.terminate();

    if (allText.length === 0) {
      warnings.push('OCR found no text in image overlays');
      return { readings: [], warnings };
    }

    const { readings, warnings: parseWarnings } = parseTextBlock(allText.join('\n'));
    return { readings, warnings: [...warnings, ...parseWarnings] };
  } catch (err: any) {
    if (worker) { try { await worker.terminate(); } catch {} }
    warnings.push(`Tesseract OCR failed: ${err?.message}`);
    return { readings: [], warnings };
  }
}

/**
 * Extract overlay regions from a canvas as inverted (black-on-white) data URLs.
 * USG machines render white/yellow text on black — Tesseract reads dark-on-light far better.
 * Captures: full image, top strip, bottom strip, left column, right column.
 */
function cropOverlayRegions(canvas: HTMLCanvasElement): string[] {
  const { width, height } = canvas;
  if (!width || !height) return [];

  const stripH = Math.floor(height * 0.25);
  const colW   = Math.floor(width  * 0.40);

  const regions: [number, number, number, number][] = [
    [0, 0, width, height],                             // full image
    [0, 0, width, stripH],                             // top strip
    [0, height - stripH, width, stripH],               // bottom strip
    [0, 0, colW, height],                              // left column
    [width - colW, 0, colW, height],                   // right column
  ];

  const results: string[] = [];
  for (const [x, y, w, h] of regions) {
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    if (!ctx) continue;

    // Draw the cropped region
    ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

    // Invert colors so white text on black → black text on white (Tesseract works much better)
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = 255 - data[i];     // R
      data[i + 1] = 255 - data[i + 1]; // G
      data[i + 2] = 255 - data[i + 2]; // B
      // alpha unchanged
    }
    ctx.putImageData(imageData, 0, 0);

    results.push(offscreen.toDataURL('image/png'));
  }

  return results;
}

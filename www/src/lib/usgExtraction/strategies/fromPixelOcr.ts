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
    await worker.setParameters({
      tessedit_pageseg_mode: '6',
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;=×xX/ ()+-°%',
    });

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
 * Extract overlay regions from a canvas as binary-thresholded (black text on white) data URLs.
 * USG machines render white/yellow text on dark — binary threshold removes speckle noise.
 */
function cropOverlayRegions(canvas: HTMLCanvasElement): string[] {
  const { width, height } = canvas;
  if (!width || !height) return [];

  const SCALE = 2;
  const THRESHOLD = 180;

  const regions: [number, number, number, number][] = [
    [Math.floor(width * 0.65), 0, Math.floor(width * 0.35), height],
    [Math.floor(width * 0.75), 0, Math.floor(width * 0.25), height],
    [0, Math.floor(height * 0.80), width, Math.floor(height * 0.20)],
    [0, 0, width, Math.floor(height * 0.15)],
    [0, 0, Math.floor(width * 0.25), height],
    [0, 0, width, height],
  ];

  const results: string[] = [];
  for (const [x, y, w, h] of regions) {
    if (w < 10 || h < 10) continue;
    const offscreen = document.createElement('canvas');
    offscreen.width = w * SCALE;
    offscreen.height = h * SCALE;
    const ctx = offscreen.getContext('2d');
    if (!ctx) continue;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, x, y, w, h, 0, 0, offscreen.width, offscreen.height);

    const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const val = gray > THRESHOLD ? 0 : 255;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    results.push(offscreen.toDataURL('image/png'));
  }

  return results;
}

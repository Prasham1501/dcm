/**
 * Strategy 2a: Node.js Tesseract OCR via Electron IPC.
 * 
 * Two approaches (tried in order):
 * 1. File-based: Read DICOM pixel data at native resolution → OCR (best quality)
 * 2. Canvas-based: Capture viewport canvas → process → OCR (fallback)
 */
import type { Reading } from '../types';
import { parseTextBlock } from '../parseUsgText';

export async function fromNodeOcr(filePaths?: string[]): Promise<{ readings: Reading[]; warnings: string[] }> {
  const warnings: string[] = [];

  const api = (window as any).electronAPI;
  if (!api?.invoke) {
    warnings.push('Electron IPC not available for Node OCR');
    return { readings: [], warnings };
  }

  // ── Approach 1: File-based OCR at native DICOM resolution ──
  if (filePaths && filePaths.length > 0) {
    console.log(`[fromNodeOcr] Trying file-based OCR on ${filePaths.length} files`);
    const allReadings: Reading[] = [];
    for (const fp of filePaths.slice(0, 15)) {
      try {
        const result = await api.invoke('ocr-dicom-file', { filePath: fp });
        if (result?.success && result.text?.trim()) {
          console.log(`[fromNodeOcr] File OCR for ${fp.split('/').pop()}:`);
          console.log(result.text.substring(0, 800));

          const { readings: fileReadings, warnings: fileWarnings } = parseTextBlock(result.text);
          console.log(`[fromNodeOcr]   → ${fileReadings.length} readings:`, fileReadings.map(r => `${r.key}=${r.value}${r.unit}`));
          allReadings.push(...fileReadings);
          warnings.push(...fileWarnings);
        }
      } catch (err: any) {
        warnings.push(`File OCR failed for ${fp}: ${err?.message}`);
      }
    }
    if (allReadings.length > 0) {
      console.log(`[fromNodeOcr] File-based total: ${allReadings.length} readings`);
      return { readings: allReadings, warnings };
    }
  }

  // ── Approach 2: Canvas-based OCR (fallback) ──
  console.log('[fromNodeOcr] Falling back to canvas-based OCR');

  const cornerstone = (window as any).__cornerstone ?? (window as any).cornerstone;
  if (!cornerstone) {
    warnings.push('Cornerstone not available for canvas capture');
    return { readings: [], warnings };
  }

  // Collect canvas crops from all rendered viewports
  const base64Images: string[] = [];
  const elements = document.querySelectorAll('[data-viewport-index], [data-cr-viewport-index]');
  console.log(`[fromNodeOcr] Found ${elements.length} viewport elements`);

  for (const el of Array.from(elements)) {
    try {
      const enabled = cornerstone.getEnabledElement(el as HTMLElement);
      if (!enabled?.canvas) { console.log('[fromNodeOcr] Viewport has no canvas'); continue; }
      console.log(`[fromNodeOcr] Canvas: ${enabled.canvas.width}x${enabled.canvas.height}`);
      const crops = cropAndProcess(enabled.canvas);
      base64Images.push(...crops);
    } catch {
      // skip unready element
    }
  }

  if (base64Images.length === 0) {
    warnings.push('No rendered viewports found for OCR');
    return { readings: [], warnings };
  }

  // Run OCR on each crop via Node.js main process
  const allText: string[] = [];
  console.log(`[fromNodeOcr] Sending ${Math.min(base64Images.length, 30)} of ${base64Images.length} crops for OCR`);
  for (const b64 of base64Images.slice(0, 30)) {
    try {
      const result = await api.invoke('ocr-image-base64', { base64: b64 });
      if (result?.success && result.text?.trim()) {
        allText.push(result.text);
      }
    } catch {
      // skip failed crop
    }
  }

  if (allText.length === 0) {
    warnings.push('Node OCR found no text in viewport canvases');
    console.warn('[fromNodeOcr] No text found from any crop');
    return { readings: [], warnings };
  }

  const joinedText = allText.join('\n');
  console.log('[fromNodeOcr] Raw OCR text (all crops combined):');
  console.log(joinedText);
  console.log('[fromNodeOcr] --- end OCR text ---');

  const { readings, warnings: parseWarnings } = parseTextBlock(joinedText);
  console.log(`[fromNodeOcr] Parsed ${readings.length} readings:`, readings.map(r => `${r.key}=${r.value}${r.unit}`));
  return { readings, warnings: [...warnings, ...parseWarnings] };
}

/**
 * Crop canvas into text-likely regions, apply processing for Tesseract.
 * USG images have bright text on dark background with speckle noise.
 * 
 * Strategy: Try multiple threshold levels per region. USG text brightness varies
 * between machines (Mindray, GE, Siemens) — what's 200 on one is 130 on another.
 * We send all variants and let Tesseract + parser find the best match.
 */
function cropAndProcess(canvas: HTMLCanvasElement): string[] {
  const { width, height } = canvas;
  if (!width || !height) return [];

  const SCALE = 2; // upscale factor for better OCR resolution

  // Focus on regions where USG machines place measurement text
  const regions: [number, number, number, number][] = [
    // Right 35% — measurement results panel (Mindray DC-7 puts readings here)
    [Math.floor(width * 0.65), 0, Math.floor(width * 0.35), height],
    // Bottom 20% — summary bar
    [0, Math.floor(height * 0.80), width, Math.floor(height * 0.20)],
    // Top 15% — header info
    [0, 0, width, Math.floor(height * 0.15)],
    // Left 25% — some machines put info here
    [0, 0, Math.floor(width * 0.25), height],
    // Full image (last resort)
    [0, 0, width, height],
  ];

  // Try multiple thresholds: USG text brightness varies wildly
  const THRESHOLDS = [100, 140, 180];

  const results: string[] = [];
  for (const [x, y, w, h] of regions) {
    if (w < 10 || h < 10) continue;

    // First get the raw upscaled crop
    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = w * SCALE;
    rawCanvas.height = h * SCALE;
    const rawCtx = rawCanvas.getContext('2d');
    if (!rawCtx) continue;
    rawCtx.imageSmoothingEnabled = false;
    rawCtx.drawImage(canvas, x, y, w, h, 0, 0, rawCanvas.width, rawCanvas.height);
    const rawData = rawCtx.getImageData(0, 0, rawCanvas.width, rawCanvas.height);

    // Also send a simple inverted version (no thresholding — lets Tesseract handle noisy input)
    try {
      const invCanvas = document.createElement('canvas');
      invCanvas.width = rawCanvas.width;
      invCanvas.height = rawCanvas.height;
      const invCtx = invCanvas.getContext('2d');
      if (invCtx) {
        const invData = new ImageData(
          new Uint8ClampedArray(rawData.data),
          rawCanvas.width, rawCanvas.height
        );
        const d = invData.data;
        for (let i = 0; i < d.length; i += 4) {
          d[i] = 255 - d[i];
          d[i + 1] = 255 - d[i + 1];
          d[i + 2] = 255 - d[i + 2];
        }
        invCtx.putImageData(invData, 0, 0);
        results.push(invCanvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''));
      }
    } catch { /* skip */ }

    // Then try each threshold
    for (const threshold of THRESHOLDS) {
      try {
        const off = document.createElement('canvas');
        off.width = rawCanvas.width;
        off.height = rawCanvas.height;
        const ctx = off.getContext('2d');
        if (!ctx) continue;

        const imgData = new ImageData(
          new Uint8ClampedArray(rawData.data),
          rawCanvas.width, rawCanvas.height
        );
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
          const val = gray > threshold ? 0 : 255;
          d[i] = val;
          d[i + 1] = val;
          d[i + 2] = val;
          d[i + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
        results.push(off.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''));
      } catch { /* skip */ }
    }
  }
  return results;
}

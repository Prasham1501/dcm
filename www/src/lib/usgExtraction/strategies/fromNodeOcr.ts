/**
 * Strategy 2b: Node.js Tesseract OCR via Electron IPC.
 * Much more reliable than browser Tesseract — uses local WASM files, no CDN.
 * Captures cornerstone canvas regions, inverts colors, sends to main process OCR.
 */
import type { Reading } from '../types';
import { parseTextBlock } from '../parseUsgText';

export async function fromNodeOcr(): Promise<{ readings: Reading[]; warnings: string[] }> {
  const warnings: string[] = [];

  const api = (window as any).electronAPI;
  if (!api?.invoke) {
    warnings.push('Electron IPC not available for Node OCR');
    return { readings: [], warnings };
  }

  const cornerstone = (window as any).__cornerstone ?? (window as any).cornerstone;
  if (!cornerstone) {
    warnings.push('Cornerstone not available for canvas capture');
    return { readings: [], warnings };
  }

  // Collect canvas crops from all rendered viewports
  const base64Images: string[] = [];
  const elements = document.querySelectorAll('[data-viewport-index], [data-cr-viewport-index]');

  for (const el of Array.from(elements)) {
    try {
      const enabled = cornerstone.getEnabledElement(el as HTMLElement);
      if (!enabled?.canvas) continue;
      const crops = cropAndInvert(enabled.canvas);
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
  for (const b64 of base64Images.slice(0, 10)) {
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
    return { readings: [], warnings };
  }

  const { readings, warnings: parseWarnings } = parseTextBlock(allText.join('\n'));
  return { readings, warnings: [...warnings, ...parseWarnings] };
}

/** Crop canvas into regions and invert colors (white-on-black → black-on-white for Tesseract) */
function cropAndInvert(canvas: HTMLCanvasElement): string[] {
  const { width, height } = canvas;
  if (!width || !height) return [];

  const stripH = Math.floor(height * 0.25);
  const colW   = Math.floor(width  * 0.40);

  const regions: [number, number, number, number][] = [
    [0, 0, width, height],                     // full image
    [0, 0, width, stripH],                     // top strip
    [0, height - stripH, width, stripH],       // bottom strip
    [0, 0, colW, height],                      // left column
    [width - colW, 0, colW, height],           // right column
  ];

  const results: string[] = [];
  for (const [x, y, w, h] of regions) {
    try {
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const ctx = off.getContext('2d');
      if (!ctx) continue;

      ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

      // Invert colors: white-on-black → black-on-white
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
      ctx.putImageData(img, 0, 0);

      // Extract as base64 PNG (strip data URL prefix)
      const dataUrl = off.toDataURL('image/png');
      results.push(dataUrl.replace(/^data:image\/png;base64,/, ''));
    } catch { /* skip */ }
  }
  return results;
}

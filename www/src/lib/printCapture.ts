import { cornerstone } from '@/lib/cornerstoneSetup';

export interface PrintOverlay {
  text: string;
  xPercent: number;
  yPercent: number;
  color: string;
  fontSize: number;
  type?: 'stamp' | 'text';
}

function imageDimension(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function defaultVoi(image: any) {
  const windowCenter = Array.isArray(image.windowCenter) ? image.windowCenter[0] : image.windowCenter;
  const windowWidth = Array.isArray(image.windowWidth) ? image.windowWidth[0] : image.windowWidth;

  return {
    windowCenter: Number.isFinite(Number(windowCenter)) ? Number(windowCenter) : 127,
    windowWidth: Number.isFinite(Number(windowWidth)) ? Number(windowWidth) : 255,
  };
}

function buildPrintViewport(sourceViewport: any, image: any) {
  const viewport = {
    ...(sourceViewport || {}),
    scale: 1,
    translation: { x: 0, y: 0 },
    voi: sourceViewport?.voi || defaultVoi(image),
    rotation: sourceViewport?.rotation || 0,
    hflip: Boolean(sourceViewport?.hflip),
    vflip: Boolean(sourceViewport?.vflip),
    invert: Boolean(sourceViewport?.invert),
    pixelReplication: Boolean(sourceViewport?.pixelReplication),
  };

  // A viewport-scaled displayedArea is the source of the print-preview letterboxing.
  delete (viewport as any).displayedArea;
  return viewport;
}

function drawOverlays(canvas: HTMLCanvasElement, overlays: PrintOverlay[]) {
  if (!overlays.length) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  for (const ov of overlays) {
    const x = (ov.xPercent / 100) * w;
    const y = (ov.yPercent / 100) * h;
    // Scale fontSize relative to canvas (assume viewport ~500px height as baseline)
    const scaledFontSize = Math.round(ov.fontSize * (h / 500));
    const isStamp = ov.type !== 'text';

    ctx.save();
    ctx.font = `bold ${scaledFontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = isStamp ? ov.text.toUpperCase() : ov.text;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = scaledFontSize;
    const padX = scaledFontSize * 0.4;
    const padY = scaledFontSize * 0.25;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - textWidth / 2 - padX, y - textHeight / 2 - padY, textWidth + padX * 2, textHeight + padY * 2);

    // Border for stamps
    if (isStamp) {
      ctx.strokeStyle = ov.color;
      ctx.lineWidth = Math.max(1, scaledFontSize / 7);
      ctx.strokeRect(x - textWidth / 2 - padX, y - textHeight / 2 - padY, textWidth + padX * 2, textHeight + padY * 2);
    }

    // Text shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    // Text
    ctx.fillStyle = ov.color;
    if (isStamp) ctx.letterSpacing = `${scaledFontSize * 0.1}px`;
    ctx.fillText(text, x, y);

    ctx.restore();
  }
}

export function captureCornerstoneElementForPrint(element: HTMLElement | null, overlays: PrintOverlay[] = []): string | null {
  if (!element) return null;

  try {
    // Composite all canvases inside the cornerstone element.
    // The base image canvas + the cornerstoneTools annotation overlay canvas(es)
    // are separate layers. Drawing them all gives us the full viewport appearance
    // including length, angle, ellipse, arrow, ROI measurements.
    const canvases = element.querySelectorAll('canvas');
    if (canvases.length > 0) {
      // Use the first (base) canvas dimensions as reference
      const baseCanvas = canvases[0];
      const baseW = baseCanvas.width || baseCanvas.clientWidth || 512;
      const baseH = baseCanvas.height || baseCanvas.clientHeight || 512;

      // For print quality, use the MAXIMUM of:
      //  - native canvas dimensions (DICOM resolution, often 512–4096)
      //  - display dimensions × devicePixelRatio
      // This ensures small viewports still produce high-res captures.
      const dpr = window.devicePixelRatio || 1;
      const displayW = Math.round((element.clientWidth || baseW) * dpr);
      const displayH = Math.round((element.clientHeight || baseH) * dpr);
      const w = Math.max(baseW, displayW);
      const h = Math.max(baseH, displayH);

      const output = document.createElement('canvas');
      output.width = w;
      output.height = h;
      const ctx = output.getContext('2d');
      if (ctx) {
        // Use high-quality image smoothing for upscale
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw each canvas layer in order (base image first, then tool overlays)
        canvases.forEach(c => {
          try {
            ctx.drawImage(c, 0, 0, w, h);
          } catch { /* cross-origin or empty canvas — skip */ }
        });

        // Draw custom text/stamp overlays on top
        drawOverlays(output, overlays);

        return output.toDataURL('image/png');
      }
    }

    // Fallback: use cornerstone.renderToCanvas (no tool annotations)
    const enabledElement = cornerstone.getEnabledElement(element);
    if (enabledElement?.image) {
      const image = enabledElement.image;
      const width = imageDimension(image.columns ?? image.width, 512);
      const height = imageDimension(image.rows ?? image.height, 512);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      cornerstone.renderToCanvas(
        canvas,
        image,
        buildPrintViewport(enabledElement.viewport || cornerstone.getViewport(element), image),
      );

      drawOverlays(canvas, overlays);

      return canvas.toDataURL('image/png');
    }
  } catch {
    const canvas = element.querySelector('canvas');
    if (canvas) return canvas.toDataURL('image/png');
  }

  return null;
}

export function captureCornerstoneViewportForPrint(indexAttribute: string, viewportIndex: number, overlays: PrintOverlay[] = []): string | null {
  const element = document.querySelector(`[${indexAttribute}="${viewportIndex}"]`) as HTMLElement | null;
  return captureCornerstoneElementForPrint(element, overlays);
}

export function captureCornerstoneElementsForPrint(selector: string, indexAttribute: string): string[] {
  return Array.from(document.querySelectorAll(selector))
    .sort((a, b) => {
      const ai = Number((a as HTMLElement).getAttribute(indexAttribute) ?? 0);
      const bi = Number((b as HTMLElement).getAttribute(indexAttribute) ?? 0);
      return ai - bi;
    })
    .map((element) => captureCornerstoneElementForPrint(element as HTMLElement) || '');
}

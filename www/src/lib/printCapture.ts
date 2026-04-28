import { cornerstone, cornerstoneTools } from '@/lib/cornerstoneSetup';

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
    const enabledElement = cornerstone.getEnabledElement(element);
    const image = enabledElement?.image;
    const canvases = element.querySelectorAll('canvas');

    if (image && canvases.length > 0) {
      // Use native DICOM image dimensions for high-res output
      const nativeW = imageDimension(image.columns ?? image.width, 512);
      const nativeH = imageDimension(image.rows ?? image.height, 512);

      // Output at native DICOM resolution for best print quality
      const w = nativeW;
      const h = nativeH;

      const output = document.createElement('canvas');
      output.width = w;
      output.height = h;
      const ctx = output.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Step 1: Render the base DICOM image at native resolution (clean, no annotations)
        const printViewport = buildPrintViewport(enabledElement.viewport || cornerstone.getViewport(element), image);
        cornerstone.renderToCanvas(output, image, printViewport);

        // Step 2: Set viewport to match print layout, hide handles, re-render with annotations
        const origViewport = cornerstone.getViewport(element);
        const store = cornerstoneTools.store;
        const origHandleRadius = store?.state?.handleRadius ?? 6;
        try { cornerstone.setViewport(element, printViewport); } catch { /* ignore */ }
        if (store?.state) store.state.handleRadius = 0;
        try { cornerstone.updateImage(element); } catch { /* ignore */ }

        // Step 3: Draw all canvases (image + annotations) scaled to native resolution
        // In cornerstone v1, annotations are drawn on canvas[0] alongside the image
        for (let i = 0; i < canvases.length; i++) {
          try {
            const c = canvases[i];
            if (c.width > 0 && c.height > 0) {
              ctx.drawImage(c, 0, 0, w, h);
            }
          } catch { /* cross-origin or empty canvas — skip */ }
        }

        // Step 4: Restore viewport and handle radius
        try { cornerstone.setViewport(element, origViewport); } catch { /* ignore */ }
        if (store?.state) store.state.handleRadius = origHandleRadius;
        try { cornerstone.updateImage(element); } catch { /* ignore */ }

        // Step 4: Draw custom text/stamp overlays on top
        drawOverlays(output, overlays);

        return output.toDataURL('image/png');
      }
    }

    // Fallback for elements without a loaded image but with canvases
    if (canvases.length > 0) {
      const baseCanvas = canvases[0];
      const baseW = baseCanvas.width || baseCanvas.clientWidth || 512;
      const baseH = baseCanvas.height || baseCanvas.clientHeight || 512;
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
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        canvases.forEach(c => {
          try { ctx.drawImage(c, 0, 0, w, h); } catch { /* skip */ }
        });
        drawOverlays(output, overlays);
        return output.toDataURL('image/png');
      }
    }

    // Fallback: use cornerstone.renderToCanvas (no tool annotations)
    if (image) {
      const width = imageDimension(image.columns ?? image.width, 512);
      const height = imageDimension(image.rows ?? image.height, 512);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      cornerstone.renderToCanvas(
        canvas,
        image,
        buildPrintViewport(enabledElement!.viewport || cornerstone.getViewport(element), image),
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

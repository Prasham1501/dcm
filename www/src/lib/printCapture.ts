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

// Industry-standard medical print quality:
// - 300 DPI on an A4 quadrant (~12.5 cm) ≈ 1500 px; full A4 long edge ≈ 3500 px.
// - Cap to 4000 px so dataURL stays manageable in memory.
const MIN_PRINT_EDGE = 2000;
const MAX_PRINT_EDGE = 4000;
const DISPLAY_QUALITY_MULTIPLIER = 4;

function defaultVoi(image: any) {
  const windowCenter = Array.isArray(image.windowCenter) ? image.windowCenter[0] : image.windowCenter;
  const windowWidth = Array.isArray(image.windowWidth) ? image.windowWidth[0] : image.windowWidth;

  return {
    windowCenter: Number.isFinite(Number(windowCenter)) ? Number(windowCenter) : 127,
    windowWidth: Number.isFinite(Number(windowWidth)) ? Number(windowWidth) : 255,
  };
}

function buildPrintViewport(sourceViewport: any, image: any, scaleFactor = 1) {
  const baseScale = sourceViewport?.scale || 1;
  const baseTx = sourceViewport?.translation || { x: 0, y: 0 };

  const viewport = {
    ...(sourceViewport || {}),
    scale: baseScale * scaleFactor,
    translation: { x: baseTx.x * scaleFactor, y: baseTx.y * scaleFactor },
    voi: sourceViewport?.voi || defaultVoi(image),
    rotation: sourceViewport?.rotation || 0,
    hflip: Boolean(sourceViewport?.hflip),
    vflip: Boolean(sourceViewport?.vflip),
    invert: Boolean(sourceViewport?.invert),
    pixelReplication: Boolean(sourceViewport?.pixelReplication),
  };

  delete (viewport as any).displayedArea;
  return viewport;
}

function getLiveCaptureSize(captureRoot: HTMLElement, canvases: HTMLCanvasElement[], image: any) {
  const rootRect = captureRoot.getBoundingClientRect();
  const cssWidth = Math.max(rootRect.width || captureRoot.clientWidth || 0, 1);
  const cssHeight = Math.max(rootRect.height || captureRoot.clientHeight || 0, 1);
  const canvasWidth = Math.max(...canvases.map((canvas) => canvas.width || 0), 0);
  const canvasHeight = Math.max(...canvases.map((canvas) => canvas.height || 0), 0);
  const nativeWidth = imageDimension(image?.columns ?? image?.width, canvasWidth || cssWidth);
  const nativeHeight = imageDimension(image?.rows ?? image?.height, canvasHeight || cssHeight);
  const sourceLongEdge = Math.max(cssWidth, cssHeight);
  const targetLongEdge = Math.min(
    MAX_PRINT_EDGE,
    Math.max(
      Math.round(sourceLongEdge * DISPLAY_QUALITY_MULTIPLIER),
      Math.max(nativeWidth, nativeHeight),
      canvasWidth,
      canvasHeight,
      MIN_PRINT_EDGE,
    ),
  );
  const scaleFactor = targetLongEdge / sourceLongEdge;

  return {
    rootRect,
    cssWidth,
    cssHeight,
    width: Math.max(1, Math.round(cssWidth * scaleFactor)),
    height: Math.max(1, Math.round(cssHeight * scaleFactor)),
    scaleFactor,
  };
}

// Render the active cornerstone image to a fresh canvas at print resolution.
// Uses native DICOM pixel data via cornerstone.renderToCanvas, preserving the
// user's viewport (windowing, pan, zoom, rotation, flip).
function renderImageAtPrintResolution(
  element: HTMLElement,
  enabledElement: any,
  image: any,
  cssWidth: number,
  cssHeight: number,
  outputWidth: number,
  outputHeight: number,
): HTMLCanvasElement | null {
  try {
    const sourceViewport = enabledElement?.viewport || cornerstone.getViewport(element);
    const scaleFactor = outputWidth / Math.max(cssWidth, 1);
    const printViewport = buildPrintViewport(sourceViewport, image, scaleFactor);

    const target = document.createElement('canvas');
    target.width = outputWidth;
    target.height = outputHeight;

    const ctx = target.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, outputWidth, outputHeight);
    }

    cornerstone.renderToCanvas(target, image, printViewport);
    return target;
  } catch {
    return null;
  }
}

// Composite remaining canvas layers (tool annotations, measurements, etc.)
// from the live DOM on top of the high-resolution image canvas.
function compositeOverlayCanvases(
  output: HTMLCanvasElement,
  captureRoot: HTMLElement,
  imageCanvas: HTMLCanvasElement | null,
  canvases: HTMLCanvasElement[],
) {
  const ctx = output.getContext('2d');
  if (!ctx) return;

  const rootRect = captureRoot.getBoundingClientRect();
  const scaleX = output.width / Math.max(rootRect.width || captureRoot.clientWidth || 1, 1);
  const scaleY = output.height / Math.max(rootRect.height || captureRoot.clientHeight || 1, 1);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  for (const canvas of canvases) {
    if (canvas === imageCanvas) continue;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width * scaleX;
    const height = rect.height * scaleY;
    if (width <= 0 || height <= 0) continue;

    const x = (rect.left - rootRect.left) * scaleX;
    const y = (rect.top - rootRect.top) * scaleY;

    try {
      ctx.drawImage(canvas, x, y, width, height);
    } catch {
      // Skip unreadable canvas layers.
    }
  }
}

function drawLiveCanvasLayers(
  output: HTMLCanvasElement,
  captureRoot: HTMLElement,
  canvases: HTMLCanvasElement[],
) {
  const ctx = output.getContext('2d');
  if (!ctx) return false;

  const rootRect = captureRoot.getBoundingClientRect();
  const scaleX = output.width / Math.max(rootRect.width || captureRoot.clientWidth || 1, 1);
  const scaleY = output.height / Math.max(rootRect.height || captureRoot.clientHeight || 1, 1);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, output.width, output.height);

  let drewAnyLayer = false;

  for (const canvas of canvases) {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width * scaleX;
    const height = rect.height * scaleY;
    if (width <= 0 || height <= 0) continue;

    const x = (rect.left - rootRect.left) * scaleX;
    const y = (rect.top - rootRect.top) * scaleY;

    try {
      ctx.drawImage(canvas, x, y, width, height);
      drewAnyLayer = true;
    } catch {
      // Skip unreadable canvas layers and keep the rest.
    }
  }

  return drewAnyLayer;
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

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - textWidth / 2 - padX, y - textHeight / 2 - padY, textWidth + padX * 2, textHeight + padY * 2);

    if (isStamp) {
      ctx.strokeStyle = ov.color;
      ctx.lineWidth = Math.max(1, scaledFontSize / 7);
      ctx.strokeRect(x - textWidth / 2 - padX, y - textHeight / 2 - padY, textWidth + padX * 2, textHeight + padY * 2);
    }

    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
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
    const captureRoot = element.parentElement instanceof HTMLElement ? element.parentElement : element;
    const canvases = Array.from(captureRoot.querySelectorAll('canvas')).filter(
      (canvas): canvas is HTMLCanvasElement => canvas instanceof HTMLCanvasElement,
    );

    // Primary path: re-render the image at print resolution from the native
    // DICOM pixel data, then composite tool overlays on top. This avoids the
    // resolution loss that comes from upscaling the on-screen canvas.
    if (image) {
      const { cssWidth, cssHeight, width, height } = getLiveCaptureSize(captureRoot, canvases, image);
      const imageCanvas = renderImageAtPrintResolution(element, enabledElement, image, cssWidth, cssHeight, width, height);

      if (imageCanvas) {
        compositeOverlayCanvases(imageCanvas, captureRoot, enabledElement?.canvas || null, canvases);
        drawOverlays(imageCanvas, overlays);
        return imageCanvas.toDataURL('image/png');
      }
    }

    // Fallback 1: composite live canvas layers (still upscaled from screen res).
    if (image && canvases.length > 0) {
      const { width, height } = getLiveCaptureSize(captureRoot, canvases, image);
      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;

      if (drawLiveCanvasLayers(output, captureRoot, canvases)) {
        drawOverlays(output, overlays);
        return output.toDataURL('image/png');
      }
    }

    // Fallback 2: stack on-screen canvases at near-native size.
    if (canvases.length > 0) {
      const sourceWidth = Math.max(...canvases.map((canvas) => canvas.width || canvas.clientWidth || 0), 1);
      const sourceHeight = Math.max(...canvases.map((canvas) => canvas.height || canvas.clientHeight || 0), 1);
      const sourceLongEdge = Math.max(sourceWidth, sourceHeight);
      const scaleFactor = Math.min(
        DISPLAY_QUALITY_MULTIPLIER,
        MAX_PRINT_EDGE / Math.max(sourceLongEdge, 1),
      );
      const width = Math.max(1, Math.round(sourceWidth * Math.max(1, scaleFactor)));
      const height = Math.max(1, Math.round(sourceHeight * Math.max(1, scaleFactor)));
      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;
      const ctx = output.getContext('2d');

      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        canvases.forEach((canvas) => {
          try { ctx.drawImage(canvas, 0, 0, width, height); } catch { /* skip */ }
        });
        drawOverlays(output, overlays);
        return output.toDataURL('image/png');
      }
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

export async function waitForViewportImages(
  indexAttribute: string,
  expectedImageIds: Array<string | null>,
  timeoutMs = 4000,
): Promise<boolean> {
  const start = performance.now();

  while (performance.now() - start < timeoutMs) {
    const ready = expectedImageIds.every((expectedImageId, viewportIndex) => {
      const element = document.querySelector(`[${indexAttribute}="${viewportIndex}"]`) as HTMLElement | null;

      if (!expectedImageId) {
        return element === null;
      }

      if (!element) return false;

      try {
        const enabledElement = cornerstone.getEnabledElement(element);
        const activeImageId = enabledElement?.image?.imageId ?? null;
        const canvas = (element.parentElement ?? element).querySelector('canvas');
        return activeImageId === expectedImageId && !!canvas && canvas.width > 0 && canvas.height > 0;
      } catch {
        return false;
      }
    });

    if (ready) return true;

    await new Promise((resolve) => window.setTimeout(resolve, 75));
  }

  return false;
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

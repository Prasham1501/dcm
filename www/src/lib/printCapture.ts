import { cornerstone, cornerstoneTools } from '@/lib/cornerstoneSetup';

export interface PrintOverlay {
  text: string;
  xPercent: number;
  yPercent: number;
  color: string;
  fontSize: number;
  fontSizePercent?: number;
  type?: 'stamp' | 'text';
}

export interface PrintDrawPath {
  points: { x: number; y: number }[]; // percent-based (0–100)
  color: string;
  strokeWidth: number;
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

// Scale the live viewport canvas to print resolution.
// cornerstone.renderToCanvas ignores the viewport scale and renders fit-to-canvas,
// so we upscale the live canvas instead — this preserves the exact zoom, pan,
// windowing, and all CornerstoneTools annotations the user sees on screen.
function renderImageAtPrintResolution(
  _element: HTMLElement,
  enabledElement: any,
  _image: any,
  _cssWidth: number,
  _cssHeight: number,
  outputWidth: number,
  outputHeight: number,
): HTMLCanvasElement | null {
  const liveCanvas = enabledElement?.canvas;
  if (!liveCanvas || !(liveCanvas instanceof HTMLCanvasElement)) return null;
  try {
    const target = document.createElement('canvas');
    target.width = outputWidth;
    target.height = outputHeight;
    const ctx = target.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, outputWidth, outputHeight);
    ctx.drawImage(liveCanvas, 0, 0, outputWidth, outputHeight);
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

// CornerstoneTools v6 draws annotations (Length, Angle, Arrow, Ellipse, etc.)
// on the SAME canvas as the image.  renderToCanvas() only renders the clean
// DICOM image — tool annotations are lost.  To recover them we pixel-diff
// the live canvas (image+tools) against a clean render (image only), then
// composite just the tool-annotation pixels onto the high-res output.
function compositeToolAnnotations(
  output: HTMLCanvasElement,
  element: HTMLElement,
  enabledElement: any,
  cssWidth: number,
  cssHeight: number,
) {
  const ctx = output.getContext('2d');
  if (!ctx) return;

  // Collect all tool state for this element
  const toolNames = [
    'Length', 'Angle', 'ArrowAnnotate', 'EllipticalRoi', 'RectangleRoi',
    'Probe', 'Bidirectional', 'CobbAngle', 'FreehandRoi', 'TextMarker',
    'ScaledEllipticalRoi',
  ];

  let hasAnnotations = false;
  for (const toolName of toolNames) {
    try {
      const state = cornerstoneTools.getToolState(element, toolName);
      if (state?.data?.length > 0) {
        hasAnnotations = true;
        break;
      }
    } catch { /* ignore */ }
  }

  if (!hasAnnotations) return;

  const liveCanvas = enabledElement?.canvas;
  if (!liveCanvas || !(liveCanvas instanceof HTMLCanvasElement)) return;
  if (liveCanvas.width <= 0 || liveCanvas.height <= 0) return;

  const w = liveCanvas.width;
  const h = liveCanvas.height;

  // --- Obtain clean pixels (image-only, no tools) ---
  const liveCtx = liveCanvas.getContext('2d');
  if (!liveCtx) return;

  let liveData: ImageData;
  try {
    liveData = liveCtx.getImageData(0, 0, w, h);
  } catch { return; }

  let cleanData: ImageData | null = null;

  // Render clean image (no tool annotations) via renderToCanvas at live canvas size.
  // setToolDisabledForElement does NOT prevent CornerstoneTools v3 from drawing
  // annotations, so we always use renderToCanvas as the clean reference.
  const cleanCanvas = document.createElement('canvas');
  cleanCanvas.width = w;
  cleanCanvas.height = h;
  try {
    const vp = enabledElement?.viewport || cornerstone.getViewport(element);
    cornerstone.renderToCanvas(cleanCanvas, enabledElement.image, vp);
    const cleanCtx = cleanCanvas.getContext('2d');
    if (cleanCtx) cleanData = cleanCtx.getImageData(0, 0, w, h);
  } catch { /* ignore */ }

  if (!cleanData) return;

  // --- Pixel diff: extract tool-annotation pixels ---
  const toolImage = ctx.createImageData(w, h);
  const cd = cleanData.data;
  const ld = liveData.data;
  const td = toolImage.data;
  const DIFF_THRESHOLD = 50; // high enough to skip rendering-noise, low enough to catch tool anti-aliasing

  for (let i = 0; i < cd.length; i += 4) {
    const dr = Math.abs(ld[i] - cd[i]);
    const dg = Math.abs(ld[i + 1] - cd[i + 1]);
    const db = Math.abs(ld[i + 2] - cd[i + 2]);
    if (dr + dg + db > DIFF_THRESHOLD) {
      td[i] = ld[i];
      td[i + 1] = ld[i + 1];
      td[i + 2] = ld[i + 2];
      td[i + 3] = ld[i + 3];
    }
  }

  // Draw tool-only pixels onto a temp canvas, then scale onto the output
  const toolCanvas = document.createElement('canvas');
  toolCanvas.width = w;
  toolCanvas.height = h;
  const toolCtx = toolCanvas.getContext('2d');
  if (!toolCtx) return;
  toolCtx.putImageData(toolImage, 0, 0);

  // Scale onto the high-res output with smooth interpolation so that
  // stretched lines and text stay thin / anti-aliased instead of blocky.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(toolCanvas, 0, 0, output.width, output.height);
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

function drawPathsOnCanvas(canvas: HTMLCanvasElement, paths: PrintDrawPath[]) {
  if (!paths.length) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  for (const path of paths) {
    if (path.points.length < 2) continue;
    ctx.save();
    ctx.strokeStyle = path.color;
    // strokeWidth is in px at screen resolution; scale proportionally to print canvas
    ctx.lineWidth = Math.max(1, (path.strokeWidth / 100) * Math.min(w, h) * 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo((path.points[0].x / 100) * w, (path.points[0].y / 100) * h);
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo((path.points[i].x / 100) * w, (path.points[i].y / 100) * h);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawOverlays(canvas: HTMLCanvasElement, overlays: PrintOverlay[], viewportCssHeight = 500) {
  if (!overlays.length) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  for (const ov of overlays) {
    const x = (ov.xPercent / 100) * w;
    const y = (ov.yPercent / 100) * h;
    const effectivePct = ov.fontSizePercent ?? (ov.fontSize / Math.max(viewportCssHeight, 100)) * 100;
    const scaledFontSize = Math.round((effectivePct / 100) * h);
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

export function captureCornerstoneElementForPrint(element: HTMLElement | null, overlays: PrintOverlay[] = [], drawPaths: PrintDrawPath[] = []): string | null {
  if (!element) return null;

  try {
    const enabledElement = cornerstone.getEnabledElement(element);
    const image = enabledElement?.image;

    // Force cornerstoneTools to redraw annotations before capture
    try { cornerstone.updateImage(element); } catch { /* ignore */ }

    const captureRoot = element.parentElement instanceof HTMLElement ? element.parentElement : element;
    const canvases = Array.from(captureRoot.querySelectorAll('canvas')).filter(
      (canvas): canvas is HTMLCanvasElement => canvas instanceof HTMLCanvasElement,
    );
    const rootCssHeight = Math.max(
      captureRoot.getBoundingClientRect().height || captureRoot.clientHeight || 500,
      1,
    );

    // Primary path: upscale the live canvas to print resolution. This preserves
    // the exact viewport state (zoom, pan, windowing) and all CornerstoneTools
    // annotations already rendered on screen.
    if (image) {
      const { cssWidth, cssHeight, width, height } = getLiveCaptureSize(captureRoot, canvases, image);
      const imageCanvas = renderImageAtPrintResolution(element, enabledElement, image, cssWidth, cssHeight, width, height);

      if (imageCanvas) {
        compositeOverlayCanvases(imageCanvas, captureRoot, enabledElement?.canvas || null, canvases);
        drawPathsOnCanvas(imageCanvas, drawPaths);
        drawOverlays(imageCanvas, overlays, cssHeight);
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
        drawPathsOnCanvas(output, drawPaths);
        drawOverlays(output, overlays, rootCssHeight);
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
        drawPathsOnCanvas(output, drawPaths);
        drawOverlays(output, overlays, rootCssHeight);
        return output.toDataURL('image/png');
      }
    }
  } catch {
    const canvas = element.querySelector('canvas');
    if (canvas) return canvas.toDataURL('image/png');
  }

  return null;
}

export function captureCornerstoneViewportForPrint(indexAttribute: string, viewportIndex: number, overlays: PrintOverlay[] = [], drawPaths: PrintDrawPath[] = []): string | null {
  const element = document.querySelector(`[${indexAttribute}="${viewportIndex}"]`) as HTMLElement | null;
  return captureCornerstoneElementForPrint(element, overlays, drawPaths);
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

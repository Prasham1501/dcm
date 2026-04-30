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
const TOOL_ANNOTATION_NAMES = [
  'Length', 'Angle', 'ArrowAnnotate', 'EllipticalRoi', 'RectangleRoi',
  'Probe', 'Bidirectional', 'CobbAngle', 'FreehandRoi', 'TextMarker',
  'ScaledEllipticalRoi',
];

interface PrintRenderResult {
  canvas: HTMLCanvasElement;
}

function defaultVoi(image: any) {
  const windowCenter = Array.isArray(image.windowCenter) ? image.windowCenter[0] : image.windowCenter;
  const windowWidth = Array.isArray(image.windowWidth) ? image.windowWidth[0] : image.windowWidth;

  return {
    windowCenter: Number.isFinite(Number(windowCenter)) ? Number(windowCenter) : 127,
    windowWidth: Number.isFinite(Number(windowWidth)) ? Number(windowWidth) : 255,
  };
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

// Render the DICOM image at full print resolution using cornerstone.renderToCanvas.
// This rasterizes from source pixel data straight onto the high-res target instead
// of upscaling the small on-screen canvas — eliminating the bicubic-stretch blur.
// Cornerstone viewport scale is in canvas pixels per image pixel, so it must be
// multiplied by the live-canvas-to-print-canvas ratio. Translation is applied
// inside that scaled image transform, so it must stay in image-space units.
function renderImageAtPrintResolution(
  element: HTMLElement,
  enabledElement: any,
  image: any,
  _cssWidth: number,
  _cssHeight: number,
  outputWidth: number,
  outputHeight: number,
): PrintRenderResult | null {
  const liveCanvas = enabledElement?.canvas;
  if (!image || !liveCanvas || !(liveCanvas instanceof HTMLCanvasElement)) return null;

  try {
    const target = document.createElement('canvas');
    target.width = outputWidth;
    target.height = outputHeight;
    const ctx = target.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, outputWidth, outputHeight);
    }

    const sourceViewport = enabledElement?.viewport || cornerstone.getViewport(element);
    const liveDeviceW = Math.max(liveCanvas.width || 0, 1);
    const liveDeviceH = Math.max(liveCanvas.height || 0, 1);
    const scaleX = outputWidth / liveDeviceW;
    const scaleY = outputHeight / liveDeviceH;
    const viewportScaleFactor = Math.min(scaleX, scaleY);
    const baseTx = sourceViewport?.translation || { x: 0, y: 0 };
    const printViewport = {
      ...(sourceViewport || {}),
      scale: (sourceViewport?.scale || 1) * viewportScaleFactor,
      translation: { x: baseTx.x, y: baseTx.y },
      voi: sourceViewport?.voi || defaultVoi(image),
    };

    cornerstone.renderToCanvas(target, image, printViewport);
    return { canvas: target };
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

function collectLiveDomOverlays(captureRoot: HTMLElement): PrintOverlay[] {
  const rootRect = captureRoot.getBoundingClientRect();
  const rootWidth = Math.max(rootRect.width || captureRoot.clientWidth || 1, 1);
  const rootHeight = Math.max(rootRect.height || captureRoot.clientHeight || 1, 1);
  const overlayEls = Array.from(
    captureRoot.querySelectorAll<HTMLElement>('[data-annotation-overlay="true"], [data-stamp-overlay="true"]'),
  );

  return overlayEls
    .map((overlayEl): PrintOverlay | null => {
      const text = overlayEl.innerText.trim();
      if (!text) return null;

      const rect = overlayEl.getBoundingClientRect();
      const styleTarget = overlayEl.querySelector<HTMLElement>('span') ?? overlayEl;
      const style = window.getComputedStyle(styleTarget);
      const inlineX = parseFloat(overlayEl.style.left || '');
      const inlineY = parseFloat(overlayEl.style.top || '');
      const fontSizeStyle = overlayEl.style.fontSize || styleTarget.style.fontSize || '';
      const cqhMatch = fontSizeStyle.match(/([\d.]+)\s*cqh/i);
      const fontSizePercent = cqhMatch ? Number(cqhMatch[1]) : undefined;
      const fontSize = parseFloat(style.fontSize) || 14;
      const borderWidth = parseFloat(style.borderTopWidth || '0') || 0;

      return {
        text,
        xPercent: Number.isFinite(inlineX) ? inlineX : ((rect.left + rect.width / 2 - rootRect.left) / rootWidth) * 100,
        yPercent: Number.isFinite(inlineY) ? inlineY : ((rect.top + rect.height / 2 - rootRect.top) / rootHeight) * 100,
        color: style.color || '#ffff00',
        fontSize: fontSizePercent ? (fontSizePercent / 100) * rootHeight : fontSize,
        fontSizePercent: fontSizePercent ?? (fontSize / rootHeight) * 100,
        type: borderWidth > 0 ? 'stamp' : 'text',
      };
    })
    .filter((overlay): overlay is PrintOverlay => Boolean(overlay));
}

function hasCornerstoneToolAnnotations(element: HTMLElement): boolean {
  return TOOL_ANNOTATION_NAMES.some((toolName) => {
    try {
      const state = cornerstoneTools.getToolState(element, toolName);
      return Array.isArray(state?.data) && state.data.length > 0;
    } catch {
      return false;
    }
  });
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
    const liveDomOverlays = collectLiveDomOverlays(captureRoot);
    const overlaysToDraw = overlays.length > 0 ? overlays : liveDomOverlays;
    const hasLiveAnnotations = overlaysToDraw.length > 0 || drawPaths.length > 0 || hasCornerstoneToolAnnotations(element);

    // Annotated viewports must preserve the live viewer's exact canvas geometry:
    // Cornerstone tool state, HTML text/stamps, and user-drawn paths do not all
    // share one stable DICOM coordinate system. Reconstructing them separately
    // caused the square/text drift seen in print preview.
    if (image && hasLiveAnnotations && canvases.length > 0) {
      const { width, height } = getLiveCaptureSize(captureRoot, canvases, image);
      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;

      if (drawLiveCanvasLayers(output, captureRoot, canvases)) {
        drawPathsOnCanvas(output, drawPaths);
        drawOverlays(output, overlaysToDraw, rootCssHeight);
        return output.toDataURL('image/png');
      }
    }

    // Primary path for plain viewports: render the image at full print
    // resolution via Cornerstone, then layer any non-tool overlays.
    if (image) {
      const { cssWidth, cssHeight, width, height } = getLiveCaptureSize(captureRoot, canvases, image);
      const renderResult = renderImageAtPrintResolution(element, enabledElement, image, cssWidth, cssHeight, width, height);

      if (renderResult) {
        const imageCanvas = renderResult.canvas;
        compositeOverlayCanvases(imageCanvas, captureRoot, enabledElement?.canvas || null, canvases);
        drawPathsOnCanvas(imageCanvas, drawPaths);
        // Text and stamp overlays are rendered as viewport-percent HTML overlays
        // in the live viewers, so print must keep them in the same viewport
        // coordinate space instead of projecting them through DICOM pixels.
        drawOverlays(imageCanvas, overlaysToDraw, cssHeight);
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
        drawOverlays(output, overlaysToDraw, rootCssHeight);
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
        drawOverlays(output, overlaysToDraw, rootCssHeight);
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

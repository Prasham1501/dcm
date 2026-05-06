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

interface PrintRenderResult {
  canvas: HTMLCanvasElement;
  viewport: Record<string, unknown>;
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

function buildPrintViewport(
  sourceViewport: any,
  image: any,
  liveCanvas: HTMLCanvasElement,
  outputWidth: number,
  outputHeight: number,
): Record<string, unknown> {
  const printScaleRatio = Math.min(
    outputWidth / Math.max(liveCanvas.width, 1),
    outputHeight / Math.max(liveCanvas.height, 1),
  );

  return {
    scale: (sourceViewport?.scale || 1) * printScaleRatio,
    // translation is in image-pixel space (applied POST-scale in
    // cornerstone's transform chain).  Scaling the viewport.scale already
    // magnifies the translation's screen effect proportionally — passing
    // the same translation values preserves the user's pan framing.
    translation: {
      x: sourceViewport?.translation?.x || 0,
      y: sourceViewport?.translation?.y || 0,
    },
    voi: sourceViewport?.voi || defaultVoi(image),
    rotation: sourceViewport?.rotation || 0,
    hflip: Boolean(sourceViewport?.hflip),
    vflip: Boolean(sourceViewport?.vflip),
    invert: Boolean(sourceViewport?.invert),
    pixelReplication: Boolean(sourceViewport?.pixelReplication),
    modalityLUT: sourceViewport?.modalityLUT,
    voiLUT: sourceViewport?.voiLUT,
    colormap: sourceViewport?.colormap,
    labelmap: sourceViewport?.labelmap,
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

// Compute the auto-fit scale that cornerstone's getImageFitScale uses.
// This is the scale factor that makes the image fit inside the canvas.
function computeFitScale(
  canvasW: number,
  canvasH: number,
  imgW: number,
  imgH: number,
  rowPS: number,
  colPS: number,
): number {
  let hRatio = 1;
  let vRatio = 1;
  if (rowPS < colPS) {
    hRatio = colPS / rowPS;
  } else {
    vRatio = rowPS / colPS;
  }
  const hScale = canvasW / imgW / hRatio;
  const vScale = canvasH / imgH / vRatio;
  return Math.min(hScale, vScale);
}

// Render the DICOM image at full print resolution using cornerstone.renderToCanvas.
// We pass only appearance properties (voi, rotation, flip, invert) and let
// renderToCanvas compute its own auto-fit scale via getDefaultViewport(printCanvas).
function renderImageAtPrintResolution(
  element: HTMLElement,
  enabledElement: any,
  image: any,
  _cssWidth: number,
  _cssHeight: number,
  outputWidth: number,
  outputHeight: number,
): PrintRenderResult | null {
  if (!image) return null;

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
    const appearanceOverrides: Record<string, unknown> = {
      voi: sourceViewport?.voi || defaultVoi(image),
      rotation: sourceViewport?.rotation || 0,
      hflip: Boolean(sourceViewport?.hflip),
      vflip: Boolean(sourceViewport?.vflip),
      invert: Boolean(sourceViewport?.invert),
      pixelReplication: Boolean(sourceViewport?.pixelReplication),
      modalityLUT: sourceViewport?.modalityLUT,
      voiLUT: sourceViewport?.voiLUT,
      colormap: sourceViewport?.colormap,
      labelmap: sourceViewport?.labelmap,
    };

    // renderToCanvas auto-fits via getDefaultViewport(target, image).
    cornerstone.renderToCanvas(target, image, appearanceOverrides);

    // Store image/canvas info for the manual transform in buildPrintTransform.
    // No cornerstone internal APIs needed — we compute everything from first principles.
    const effectiveViewport = {
      ...appearanceOverrides,
      // These are computed identically to getDefaultViewport + getImageFitScale
      _imgW: image.columns || image.width || 1,
      _imgH: image.rows || image.height || 1,
      _canvasW: outputWidth,
      _canvasH: outputHeight,
      _rowPS: image.rowPixelSpacing || 1,
      _colPS: image.columnPixelSpacing || 1,
    };

    return { canvas: target, viewport: effectiveViewport };
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

const CORNERSTONE_VECTOR_TOOLS = [
  'Length', 'Angle', 'ArrowAnnotate', 'EllipticalRoi', 'RectangleRoi',
  'CircleRoi', 'Probe', 'Bidirectional', 'CobbAngle', 'FreehandRoi',
  'TextMarker', 'ScaledEllipticalRoi',
];

function getToolColor(data: any): string {
  return data?.color || data?.activeColor || cornerstoneTools.toolColors?.getToolColor?.() || '#ffff00';
}

function getToolLineWidth(printScale: number): number {
  let baseWidth = 2;
  try {
    baseWidth = cornerstoneTools.toolStyle?.getToolWidth?.() || baseWidth;
  } catch { /* keep default */ }
  return Math.max(1, baseWidth * printScale);
}

// Build a transform that maps image-pixel coordinates to print-canvas coordinates.
// Computed from first principles — mirrors EXACTLY what cornerstone's calculateTransform
// does for the auto-fit viewport that renderToCanvas produces internally.
// No dependency on cornerstone.internal APIs.
function buildPrintTransform(
  _printCanvas: HTMLCanvasElement,
  _image: any,
  vp: Record<string, unknown>,
) {
  const imgW = (vp._imgW as number) || 1;
  const imgH = (vp._imgH as number) || 1;
  const canvasW = (vp._canvasW as number) || 1;
  const canvasH = (vp._canvasH as number) || 1;
  const rowPS = (vp._rowPS as number) || 1;
  const colPS = (vp._colPS as number) || 1;
  const rotation = ((vp.rotation as number) || 0) * Math.PI / 180;
  const hflip = vp.hflip as boolean;
  const vflip = vp.vflip as boolean;

  // Auto-fit scale — identical to getImageFitScale in cornerstone-core.
  const fitScale = computeFitScale(canvasW, canvasH, imgW, imgH, rowPS, colPS);

  // Per-axis scales — identical to calculateTransform's pixel spacing correction
  // for presentationSizeMode === 'NONE'.
  let wScale = fitScale;
  let hScale = fitScale;
  if (rowPS < colPS) {
    wScale *= colPS / rowPS;
  } else if (colPS < rowPS) {
    hScale *= rowPS / colPS;
  }

  return {
    transformPoint(px: number, py: number): { x: number; y: number } {
      // Point traversal order (matching cornerstone's calculateTransform):
      // 1. Center offset  2. Flip  3. Scale  4. Rotate  5. Canvas center
      let x = px - imgW / 2;
      let y = py - imgH / 2;

      // Flip
      if (hflip) x = -x;
      if (vflip) y = -y;

      // Scale (per-axis, with pixel spacing correction)
      x *= wScale;
      y *= hScale;

      // Rotation (applied AFTER scale in point traversal order)
      if (rotation !== 0) {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        x = rx;
        y = ry;
      }

      // Translate to canvas center
      x += canvasW / 2;
      y += canvasH / 2;

      return { x, y };
    },
  };
}

function asPoint(point: any): { x: number; y: number } | null {
  const x = Number(point?.x);
  const y = Number(point?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function transformPoint(transform: any, point: any): { x: number; y: number } | null {
  const p = asPoint(point);
  if (!p || !transform?.transformPoint) return null;
  try {
    const transformed = transform.transformPoint(p.x, p.y);
    return asPoint(transformed);
  } catch {
    return null;
  }
}

function strokeTransformedPolyline(
  ctx: CanvasRenderingContext2D,
  transform: any,
  points: any[],
  closePath = false,
): boolean {
  const canvasPoints = points.map((point) => transformPoint(transform, point)).filter(Boolean) as Array<{ x: number; y: number }>;
  if (canvasPoints.length < 2) return false;

  ctx.beginPath();
  ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
  for (let i = 1; i < canvasPoints.length; i++) {
    ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
  }
  if (closePath) ctx.closePath();
  ctx.stroke();
  return true;
}

function drawTransformedEllipse(ctx: CanvasRenderingContext2D, transform: any, start: any, end: any): boolean {
  const s = asPoint(start);
  const e = asPoint(end);
  if (!s || !e) return false;

  const cx = (s.x + e.x) / 2;
  const cy = (s.y + e.y) / 2;
  const rx = Math.abs(e.x - s.x) / 2;
  const ry = Math.abs(e.y - s.y) / 2;
  if (rx <= 0 || ry <= 0) return false;

  const segments = 96;
  const points = Array.from({ length: segments }, (_, i) => {
    const theta = (i / segments) * Math.PI * 2;
    return { x: cx + Math.cos(theta) * rx, y: cy + Math.sin(theta) * ry };
  });
  return strokeTransformedPolyline(ctx, transform, points, true);
}

function drawArrowHead(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, size: number) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 6), to.y - size * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 6), to.y - size * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

function drawCross(ctx: CanvasRenderingContext2D, point: { x: number; y: number }, size: number) {
  ctx.beginPath();
  ctx.moveTo(point.x - size, point.y);
  ctx.lineTo(point.x + size, point.y);
  ctx.moveTo(point.x, point.y - size);
  ctx.lineTo(point.x, point.y + size);
  ctx.stroke();
}

function drawVectorToolData(
  ctx: CanvasRenderingContext2D,
  transform: any,
  toolName: string,
  data: any,
  printScale: number,
): boolean {
  const handles = data?.handles || {};
  const start = handles.start;
  const end = handles.end;
  let drew = false;

  ctx.save();
  ctx.strokeStyle = getToolColor(data);
  ctx.fillStyle = getToolColor(data);
  ctx.lineWidth = getToolLineWidth(printScale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (toolName === 'EllipticalRoi' || toolName === 'ScaledEllipticalRoi' || toolName === 'CircleRoi') {
    drew = drawTransformedEllipse(ctx, transform, start, end);
  } else if (toolName === 'RectangleRoi' && start && end) {
    const s = asPoint(start);
    const e = asPoint(end);
    if (s && e) {
      drew = strokeTransformedPolyline(ctx, transform, [
        { x: s.x, y: s.y },
        { x: e.x, y: s.y },
        { x: e.x, y: e.y },
        { x: s.x, y: e.y },
      ], true);
    }
  } else if (toolName === 'Angle' && handles.start && handles.middle && handles.end) {
    drew = strokeTransformedPolyline(ctx, transform, [handles.start, handles.middle, handles.end]);
  } else if (toolName === 'Bidirectional') {
    drew = strokeTransformedPolyline(ctx, transform, [handles.start, handles.end]);
    if (handles.perpendicularStart && handles.perpendicularEnd) {
      drew = strokeTransformedPolyline(ctx, transform, [handles.perpendicularStart, handles.perpendicularEnd]) || drew;
    }
  } else if (toolName === 'CobbAngle') {
    drew = strokeTransformedPolyline(ctx, transform, [handles.start, handles.end]);
    if (handles.start2 && handles.end2) {
      drew = strokeTransformedPolyline(ctx, transform, [handles.start2, handles.end2]) || drew;
    }
  } else if (toolName === 'FreehandRoi') {
    const points = handles.points || data?.polyline || data?.points || [];
    drew = Array.isArray(points) ? strokeTransformedPolyline(ctx, transform, points, true) : false;
  } else if (toolName === 'Probe') {
    const point = transformPoint(transform, handles.end || handles.start);
    if (point) {
      drawCross(ctx, point, Math.max(4, 5 * printScale));
      drew = true;
    }
  } else if (toolName === 'TextMarker') {
    const point = transformPoint(transform, handles.end || handles.start || handles.textBox);
    const text = String(data?.text || data?.textMarker || data?.label || '');
    if (point && text) {
      ctx.font = `bold ${Math.max(10, 12 * printScale)}px Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, point.x, point.y);
      drew = true;
    }
  } else if (start && end) {
    drew = strokeTransformedPolyline(ctx, transform, [start, end]);
    if (toolName === 'ArrowAnnotate') {
      const from = transformPoint(transform, start);
      const to = transformPoint(transform, end);
      if (from && to) drawArrowHead(ctx, from, to, Math.max(8, 10 * printScale));
    }
  }

  if (drew && handles.textBox && (data?.text || data?.label)) {
    const textPoint = transformPoint(transform, handles.textBox);
    if (textPoint) {
      ctx.font = `bold ${Math.max(10, 11 * printScale)}px Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(data.text || data.label), textPoint.x, textPoint.y);
    }
  }

  ctx.restore();
  return drew;
}

function drawCornerstoneToolAnnotations(
  output: HTMLCanvasElement,
  element: HTMLElement,
  enabledElement: any,
  printViewport: Record<string, unknown>,
  cssWidth: number,
  cssHeight: number,
): boolean {
  const ctx = output.getContext('2d');
  if (!ctx || !enabledElement?.image) return false;

  const transform = buildPrintTransform(output, enabledElement.image, printViewport);
  if (!transform) return false;

  const printScale = Math.min(
    output.width / Math.max(cssWidth, 1),
    output.height / Math.max(cssHeight, 1),
  );
  let drewAny = false;

  for (const toolName of CORNERSTONE_VECTOR_TOOLS) {
    let state: any;
    try {
      state = cornerstoneTools.getToolState(element, toolName);
    } catch {
      state = null;
    }
    if (!state?.data?.length) continue;

    for (const data of state.data) {
      drewAny = drawVectorToolData(ctx, transform, toolName, data, printScale) || drewAny;
    }
  }

  return drewAny;
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
    // On screen, draw paths render in a viewBox="0 0 100 100" with strokeWidth=0.5
    // (0.5% of viewport). Replicate that proportionally on the print canvas.
    ctx.lineWidth = Math.max(1, 0.005 * Math.min(w, h));
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

    // Primary path: render the image at full print resolution via cornerstone,
    // then layer cornerstone-tool annotations (Length/Angle/ROI), other canvas
    // overlays (active draw stroke, etc.), stored draw paths, and text/stamps.
    if (image) {
      const { cssWidth, cssHeight, width, height } = getLiveCaptureSize(captureRoot, canvases, image);
      const printRender = renderImageAtPrintResolution(element, enabledElement, image, cssWidth, cssHeight, width, height);

      if (printRender) {
        const { canvas: imageCanvas, viewport: printViewport } = printRender;
        const drewVectorTools = drawCornerstoneToolAnnotations(
          imageCanvas,
          element,
          enabledElement,
          printViewport,
          cssWidth,
          cssHeight,
        );
        if (!drewVectorTools) {
          compositeToolAnnotations(imageCanvas, element, enabledElement, cssWidth, cssHeight);
        }
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

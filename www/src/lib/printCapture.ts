/**
 * High-resolution print capture for cornerstone viewports.
 *
 * Strategy (the one used by OHIF / Cornerstone3D for export):
 *
 * Temporarily resize the LIVE cornerstone canvas up to print resolution and
 * let cornerstone + cornerstone-tools redraw the image AND its annotations
 * onto that same canvas — using their own transform pipeline.  No manual
 * transform replication, no fake enabled elements.
 *
 * Critical detail: `cornerstone.updateImage` is asynchronous in v2 — it
 * only sets `needsRedraw`/`invalid` flags, and the actual draw happens on
 * the next animation frame, with `cornerstoneimagerendered` firing after
 * the image is painted.  cornerstone-tools listens to that event and
 * paints all annotations on the same canvas.  We therefore MUST await the
 * `cornerstoneimagerendered` event before reading `toDataURL()`, otherwise
 * we capture a blank canvas.
 *
 * Why we abandoned manual `calculateTransform` replication:
 *   Cornerstone v2's `calculateTransform` is a 10-step matrix chain.
 *   Hand-rolled copies drift in non-obvious cases (non-square pixel
 *   spacing, non-zero translation, displayedArea offsets).  Letting the
 *   library do its own math is the only reliable approach.
 */
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

// Industry-standard medical print quality:
// 300 DPI on an A4 quadrant (~12.5 cm) ≈ 1500 px; full A4 long edge ≈ 3500 px.
const MIN_PRINT_EDGE = 2000;
const MAX_PRINT_EDGE = 4000;
const DISPLAY_QUALITY_MULTIPLIER = 4;

function imageDimension(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function getCaptureSize(captureRoot: HTMLElement, liveCanvas: HTMLCanvasElement | null, image: any) {
  const rootRect = captureRoot.getBoundingClientRect();
  const cssWidth = Math.max(rootRect.width || captureRoot.clientWidth || 0, 1);
  const cssHeight = Math.max(rootRect.height || captureRoot.clientHeight || 0, 1);
  const liveCanvasW = liveCanvas?.width || 0;
  const liveCanvasH = liveCanvas?.height || 0;
  const nativeWidth = imageDimension(image?.columns ?? image?.width, liveCanvasW || cssWidth);
  const nativeHeight = imageDimension(image?.rows ?? image?.height, liveCanvasH || cssHeight);

  const sourceLongEdge = Math.max(cssWidth, cssHeight);
  const targetLongEdge = Math.min(
    MAX_PRINT_EDGE,
    Math.max(
      Math.round(sourceLongEdge * DISPLAY_QUALITY_MULTIPLIER),
      Math.max(nativeWidth, nativeHeight),
      liveCanvasW,
      liveCanvasH,
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

/** Wait for the next `cornerstoneimagerendered` event on this element. The
 *  cornerstone-tools rendering happens INSIDE this event handler, so once
 *  this promise resolves, the canvas contains image + annotations. */
function waitForRender(element: HTMLElement, timeoutMs = 1000): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const handler = () => {
      if (done) return;
      done = true;
      element.removeEventListener('cornerstoneimagerendered', handler);
      // One animation frame after the event so any synchronous tool-rendering
      // listeners (cornerstone-tools v3 attaches its renderToolData here) have
      // finished painting.
      requestAnimationFrame(() => resolve());
    };
    element.addEventListener('cornerstoneimagerendered', handler);
    // Safety net — never block the print pipeline forever.
    setTimeout(() => {
      if (done) return;
      done = true;
      element.removeEventListener('cornerstoneimagerendered', handler);
      resolve();
    }, timeoutMs);
  });
}

/** Composite stored draw paths (% coords) onto an existing print canvas. */
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
    // On screen these paths render in an SVG with `viewBox="0 0 100 100"` and
    // strokeWidth=0.5 (% of viewport).  Replicate that proportionally.
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

/** Composite text/stamp overlays (% coords + % font size) onto a print canvas. */
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
    ctx.fillRect(
      x - textWidth / 2 - padX,
      y - textHeight / 2 - padY,
      textWidth + padX * 2,
      textHeight + padY * 2,
    );

    if (isStamp) {
      ctx.strokeStyle = ov.color;
      ctx.lineWidth = Math.max(1, scaledFontSize / 7);
      ctx.strokeRect(
        x - textWidth / 2 - padX,
        y - textHeight / 2 - padY,
        textWidth + padX * 2,
        textHeight + padY * 2,
      );
    }

    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = ov.color;
    if (isStamp) (ctx as any).letterSpacing = `${scaledFontSize * 0.1}px`;
    ctx.fillText(text, x, y);

    ctx.restore();
  }
}

/** Snapshot the live canvas pixels into a detached canvas so we can composite
 *  HTML/SVG-style overlays on top without disturbing the live one. */
function snapshotWithOverlays(
  liveCanvas: HTMLCanvasElement,
  drawPaths: PrintDrawPath[],
  overlays: PrintOverlay[],
  viewportCssHeight: number,
): string {
  const out = document.createElement('canvas');
  out.width = liveCanvas.width;
  out.height = liveCanvas.height;
  const ctx = out.getContext('2d');
  if (ctx) {
    try { ctx.drawImage(liveCanvas, 0, 0); } catch { /* ignore */ }
    drawPathsOnCanvas(out, drawPaths);
    drawOverlays(out, overlays, viewportCssHeight);
  }
  try {
    return out.toDataURL('image/png');
  } catch {
    return liveCanvas.toDataURL('image/png');
  }
}

/**
 * Async capture: temporarily resizes the live cornerstone canvas to print
 * resolution, awaits cornerstone's redraw + cornerstone-tools' annotation
 * pass, snapshots the pixels, then restores everything.
 *
 * Use this for highest-quality output.  The image and annotations are drawn
 * by the same code that renders them on screen — they cannot drift apart.
 */
export async function captureCornerstoneElementForPrintAsync(
  element: HTMLElement | null,
  overlays: PrintOverlay[] = [],
  drawPaths: PrintDrawPath[] = [],
): Promise<string | null> {
  if (!element) return null;

  let enabledElement: any = null;
  try {
    enabledElement = cornerstone.getEnabledElement(element);
  } catch { /* not enabled */ }

  const image = enabledElement?.image;
  const liveCanvas: HTMLCanvasElement | null = enabledElement?.canvas || null;
  const captureRoot =
    element.parentElement instanceof HTMLElement ? element.parentElement : element;
  const rootCssHeight = Math.max(
    captureRoot.getBoundingClientRect().height || captureRoot.clientHeight || 500,
    1,
  );

  if (image && liveCanvas) {
    const { width: outW, height: outH, cssHeight } = getCaptureSize(captureRoot, liveCanvas, image);
    const origW = liveCanvas.width;
    const origH = liveCanvas.height;
    const origCssW = liveCanvas.style.width;
    const origCssH = liveCanvas.style.height;
    const origScale = enabledElement.viewport?.scale ?? 1;
    const origTranslation = enabledElement.viewport?.translation
      ? { x: enabledElement.viewport.translation.x, y: enabledElement.viewport.translation.y }
      : { x: 0, y: 0 };

    let ratio = 1;
    if (origW > 0 && origH > 0) {
      ratio = Math.min(outW / origW, outH / origH);
    }
    if (!Number.isFinite(ratio) || ratio <= 0) ratio = 1;

    let dataUrl: string | null = null;

    try {
      // Pin the canvas's CSS box so the buffer-resize doesn't leak into layout.
      // (`canvas.width`/`height` are pixel-buffer dimensions; CSS dimensions
      // are independent, but if neither is set the browser uses the buffer
      // as the rendered size, which would briefly enlarge the live element.)
      const cssW = liveCanvas.clientWidth || origW;
      const cssH = liveCanvas.clientHeight || origH;
      if (cssW > 0) liveCanvas.style.width = `${cssW}px`;
      if (cssH > 0) liveCanvas.style.height = `${cssH}px`;

      // Resize the pixel buffer to print resolution.  Setting `canvas.width`
      // ALWAYS clears the canvas — that's fine because we're about to ask
      // cornerstone to repaint it.
      liveCanvas.width = outW;
      liveCanvas.height = outH;

      // Preserve the user's framing: scale `viewport.scale` by the same ratio.
      // `viewport.translation` is in image-pixel space (applied before the
      // canvas-pixel scale by cornerstone's transform chain), so it is
      // independent of buffer size and copies through unchanged.
      if (enabledElement.viewport) {
        enabledElement.viewport.scale = origScale * ratio;
      }

      // Annotations (ellipse / rectangle / line / arrow / angle) are drawn by
      // cornerstone-tools using a single global stroke width — tuned for the
      // ~500-px on-screen viewport. When we capture at print resolution
      // (~2400 px, i.e. ~5× larger) those strokes become hair-thin.
      // Temporarily scale the global tool-width by the same ratio we use for
      // the canvas, then restore it after the snapshot.
      let origToolWidth: number | null = null;
      try {
        const cstools: any = cornerstoneTools;
        if (cstools?.toolStyle?.getToolWidth) {
          origToolWidth = cstools.toolStyle.getToolWidth();
          const boosted = Math.max(2, (origToolWidth || 1) * ratio);
          cstools.toolStyle.setToolWidth(boosted);
          if (cstools.toolStyle.setActiveWidth) cstools.toolStyle.setActiveWidth(boosted);
        }
      } catch { /* tool style not available — annotations will print at default thickness */ }

      // Trigger the redraw and wait for it to actually happen.  Cornerstone's
      // updateImage just sets a flag; the real paint (and the
      // cornerstone-tools annotation pass that runs inside the
      // cornerstoneimagerendered handler) happens on the next animation frame.
      const renderDone = waitForRender(element);
      cornerstone.updateImage(element, true);
      await renderDone;

      dataUrl = snapshotWithOverlays(liveCanvas, drawPaths, overlays, cssHeight);

      // Restore the original stroke width before any subsequent (live) render.
      if (origToolWidth !== null) {
        try {
          const cstools: any = cornerstoneTools;
          cstools?.toolStyle?.setToolWidth?.(origToolWidth);
          cstools?.toolStyle?.setActiveWidth?.(origToolWidth);
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.warn('[printCapture] hi-DPI live-canvas capture failed', err);
      dataUrl = null;
    } finally {
      // Restore: viewport first (so the next render uses the right scale for
      // the original buffer size), then canvas dims, then redraw.  Wait for
      // that redraw too — otherwise the live screen would be left blank
      // until the next user interaction.
      try {
        if (enabledElement.viewport) {
          enabledElement.viewport.scale = origScale;
          enabledElement.viewport.translation = origTranslation;
        }
        liveCanvas.width = origW;
        liveCanvas.height = origH;
        liveCanvas.style.width = origCssW;
        liveCanvas.style.height = origCssH;
        const restoreDone = waitForRender(element);
        cornerstone.updateImage(element, true);
        await restoreDone;
      } catch { /* ignore restore failures */ }
    }

    if (dataUrl) return dataUrl;
  }

  // Fallback path: upscale whatever the live canvas already has.  Annotations
  // are already painted into the live canvas by cornerstone-tools, so this is
  // still positionally correct — just lower-resolution than the primary path.
  if (liveCanvas && liveCanvas.width > 0 && liveCanvas.height > 0) {
    const sourceLongEdge = Math.max(liveCanvas.width, liveCanvas.height);
    const scaleFactor = Math.min(
      DISPLAY_QUALITY_MULTIPLIER,
      MAX_PRINT_EDGE / Math.max(sourceLongEdge, 1),
    );
    const w = Math.max(1, Math.round(liveCanvas.width * Math.max(1, scaleFactor)));
    const h = Math.max(1, Math.round(liveCanvas.height * Math.max(1, scaleFactor)));
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      try { ctx.drawImage(liveCanvas, 0, 0, w, h); } catch { /* skip */ }
      drawPathsOnCanvas(out, drawPaths);
      drawOverlays(out, overlays, rootCssHeight);
      try { return out.toDataURL('image/png'); } catch { /* fall through */ }
    }
  }

  return null;
}

export async function captureCornerstoneViewportForPrintAsync(
  indexAttribute: string,
  viewportIndex: number,
  overlays: PrintOverlay[] = [],
  drawPaths: PrintDrawPath[] = [],
): Promise<string | null> {
  const element = document.querySelector(`[${indexAttribute}="${viewportIndex}"]`) as HTMLElement | null;
  return captureCornerstoneElementForPrintAsync(element, overlays, drawPaths);
}

// -- Legacy synchronous API ----------------------------------------------
// Kept for callers that expect a synchronous result.  This path uses the
// live canvas as-is (whatever cornerstone+cornerstone-tools last painted on
// it) and upscales it.  Annotations stay aligned with the image because
// they're already baked into the same source pixels — they just end up
// slightly softened by the upscale.  All print preview surfaces in this
// codebase have switched to the async path; this remains as a safety net.

export function captureCornerstoneElementForPrint(
  element: HTMLElement | null,
  overlays: PrintOverlay[] = [],
  drawPaths: PrintDrawPath[] = [],
): string | null {
  if (!element) return null;

  try {
    const enabledElement = cornerstone.getEnabledElement(element);
    const liveCanvas: HTMLCanvasElement | null = enabledElement?.canvas || null;
    const captureRoot =
      element.parentElement instanceof HTMLElement ? element.parentElement : element;
    const rootCssHeight = Math.max(
      captureRoot.getBoundingClientRect().height || captureRoot.clientHeight || 500,
      1,
    );

    if (liveCanvas && liveCanvas.width > 0 && liveCanvas.height > 0) {
      const sourceLongEdge = Math.max(liveCanvas.width, liveCanvas.height);
      const scaleFactor = Math.min(
        DISPLAY_QUALITY_MULTIPLIER,
        MAX_PRINT_EDGE / Math.max(sourceLongEdge, 1),
      );
      const w = Math.max(1, Math.round(liveCanvas.width * Math.max(1, scaleFactor)));
      const h = Math.max(1, Math.round(liveCanvas.height * Math.max(1, scaleFactor)));
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        try { ctx.drawImage(liveCanvas, 0, 0, w, h); } catch { /* skip */ }
        drawPathsOnCanvas(out, drawPaths);
        drawOverlays(out, overlays, rootCssHeight);
        try { return out.toDataURL('image/png'); } catch { /* fall through */ }
      }
    }
  } catch (err) {
    console.warn('[printCapture] sync capture failed', err);
    const canvas = element.querySelector('canvas');
    if (canvas) {
      try { return canvas.toDataURL('image/png'); } catch { /* ignore */ }
    }
  }
  return null;
}

export function captureCornerstoneViewportForPrint(
  indexAttribute: string,
  viewportIndex: number,
  overlays: PrintOverlay[] = [],
  drawPaths: PrintDrawPath[] = [],
): string | null {
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
      if (!expectedImageId) return element === null;
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
    await new Promise((r) => window.setTimeout(r, 75));
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

// `cornerstoneTools` import is required for tools to register globally; this
// no-op reference keeps tree-shakers from stripping the side-effectful import.
void cornerstoneTools;

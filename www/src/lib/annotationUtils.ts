/**
 * Shared annotation utilities for undo, auto-deactivate, and editing.
 * Used across CR Viewer, main Viewer, and Dual Viewer.
 */
import { cornerstone, cornerstoneTools } from './cornerstoneSetup';

const ANNOTATION_TOOLS = [
  'Length', 'Angle', 'EllipticalRoi', 'RectangleRoi',
  'FreehandRoi', 'ArrowAnnotate', 'TextMarker', 'Probe',
];

/**
 * Flag to prevent grid double-click (zoom-to-1) from firing
 * when an annotation edit double-click was handled.
 */
let _dblClickHandledAt = 0;
export function markDblClickHandled() { _dblClickHandledAt = Date.now(); }
export function wasDblClickHandled() { return Date.now() - _dblClickHandledAt < 300; }

/**
 * Undo the last annotation on a specific cornerstone element.
 * Removes the most recently added annotation across all tool types.
 */
export function undoLastAnnotationOnElement(element: HTMLElement): boolean {
  let lastTool = '';
  let lastData: any = null;
  let maxTimestamp = 0;

  ANNOTATION_TOOLS.forEach(toolName => {
    try {
      const state = cornerstoneTools.getToolState(element, toolName);
      if (state?.data?.length > 0) {
        const lastEntry = state.data[state.data.length - 1];
        // Use creation timestamp if available, otherwise use index-based heuristic
        const ts = lastEntry._timestamp || state.data.length;
        if (ts >= maxTimestamp) {
          maxTimestamp = ts;
          lastTool = toolName;
          lastData = state;
        }
      }
    } catch { /* ignore */ }
  });

  if (lastTool && lastData?.data?.length > 0) {
    lastData.data.pop();
    try { cornerstone.updateImage(element); } catch { /* ignore */ }
    return true;
  }
  return false;
}

/**
 * Undo annotation on elements identified by a data attribute selector.
 * For CRViewer: '[data-cr-viewport-index="N"]'
 * For DualViewer: '[data-dual-viewport-index="panelId-N"]'
 * For main Viewer: '[data-viewport-index="N"]'
 */
export function undoAnnotationBySelector(selector: string): boolean {
  const el = document.querySelector(selector) as HTMLElement;
  if (!el) return false;
  return undoLastAnnotationOnElement(el);
}

/**
 * Find annotation data at a given point on the cornerstone element.
 * Returns { toolName, annotationIndex, data } if found.
 * Checks: handle proximity, line midpoint, bounding box edges for ROI tools.
 */
export function findAnnotationAtPoint(
  element: HTMLElement,
  canvasX: number,
  canvasY: number,
  threshold = 15
): { toolName: string; annotationIndex: number; data: any } | null {
  for (const toolName of ANNOTATION_TOOLS) {
    try {
      const state = cornerstoneTools.getToolState(element, toolName);
      if (!state?.data) continue;

      for (let i = state.data.length - 1; i >= 0; i--) {
        const annotation = state.data[i];
        if (!annotation.handles) continue;

        const handles = annotation.handles;
        const handleKeys = Object.keys(handles).filter(k => k !== 'textBox');

        // 1) Check if click is near any handle point
        for (const key of handleKeys) {
          const handle = handles[key];
          if (handle?.x !== undefined && handle?.y !== undefined) {
            try {
              const canvasPoint = cornerstone.pixelToCanvas(element, { x: handle.x, y: handle.y });
              const dx = canvasPoint.x - canvasX;
              const dy = canvasPoint.y - canvasY;
              if (Math.sqrt(dx * dx + dy * dy) < threshold) {
                return { toolName, annotationIndex: i, data: annotation };
              }
            } catch { /* ignore */ }
          }
        }

        // 2) For ROI tools (Ellipse, Rectangle): check if click is near the bounding box edges
        if ((toolName === 'EllipticalRoi' || toolName === 'RectangleRoi') && handles.start && handles.end) {
          try {
            const s = cornerstone.pixelToCanvas(element, { x: handles.start.x, y: handles.start.y });
            const e = cornerstone.pixelToCanvas(element, { x: handles.end.x, y: handles.end.y });
            const minX = Math.min(s.x, e.x);
            const maxX = Math.max(s.x, e.x);
            const minY = Math.min(s.y, e.y);
            const maxY = Math.max(s.y, e.y);

            if (toolName === 'RectangleRoi') {
              // Check proximity to any of the 4 rectangle edges
              const nearLeft = Math.abs(canvasX - minX) < threshold && canvasY >= minY - threshold && canvasY <= maxY + threshold;
              const nearRight = Math.abs(canvasX - maxX) < threshold && canvasY >= minY - threshold && canvasY <= maxY + threshold;
              const nearTop = Math.abs(canvasY - minY) < threshold && canvasX >= minX - threshold && canvasX <= maxX + threshold;
              const nearBottom = Math.abs(canvasY - maxY) < threshold && canvasX >= minX - threshold && canvasX <= maxX + threshold;
              if (nearLeft || nearRight || nearTop || nearBottom) {
                return { toolName, annotationIndex: i, data: annotation };
              }
            } else {
              // Ellipse: check if point is near the ellipse border
              const cx = (minX + maxX) / 2;
              const cy = (minY + maxY) / 2;
              const rx = (maxX - minX) / 2;
              const ry = (maxY - minY) / 2;
              if (rx > 0 && ry > 0) {
                const normalized = Math.pow((canvasX - cx) / rx, 2) + Math.pow((canvasY - cy) / ry, 2);
                // Near the ellipse border if normalized value is close to 1.0
                if (Math.abs(normalized - 1.0) < 0.4) {
                  return { toolName, annotationIndex: i, data: annotation };
                }
              }
            }
          } catch { /* ignore */ }
        }

        // 3) Check midpoint of start-end for line-type tools
        if (handles.start && handles.end) {
          try {
            const startCanvas = cornerstone.pixelToCanvas(element, { x: handles.start.x, y: handles.start.y });
            const endCanvas = cornerstone.pixelToCanvas(element, { x: handles.end.x, y: handles.end.y });
            const midX = (startCanvas.x + endCanvas.x) / 2;
            const midY = (startCanvas.y + endCanvas.y) / 2;
            const dx = midX - canvasX;
            const dy = midY - canvasY;
            if (Math.sqrt(dx * dx + dy * dy) < threshold) {
              return { toolName, annotationIndex: i, data: annotation };
            }
            // Also check along the line (for Length, etc.)
            if (toolName === 'Length' || toolName === 'ArrowAnnotate') {
              const lineLen = Math.sqrt(Math.pow(endCanvas.x - startCanvas.x, 2) + Math.pow(endCanvas.y - startCanvas.y, 2));
              if (lineLen > 0) {
                // Point-to-line distance
                const dist = Math.abs(
                  (endCanvas.y - startCanvas.y) * canvasX - (endCanvas.x - startCanvas.x) * canvasY +
                  endCanvas.x * startCanvas.y - endCanvas.y * startCanvas.x
                ) / lineLen;
                // Check if point is within the line segment bounds
                const t = ((canvasX - startCanvas.x) * (endCanvas.x - startCanvas.x) + (canvasY - startCanvas.y) * (endCanvas.y - startCanvas.y)) / (lineLen * lineLen);
                if (dist < threshold && t >= -0.05 && t <= 1.05) {
                  return { toolName, annotationIndex: i, data: annotation };
                }
              }
            }
          } catch { /* ignore */ }
        }

        // 4) Check textBox handle (the measurement label)
        if (handles.textBox?.x !== undefined && handles.textBox?.y !== undefined) {
          try {
            const tbCanvas = cornerstone.pixelToCanvas(element, { x: handles.textBox.x, y: handles.textBox.y });
            const dx = tbCanvas.x - canvasX;
            const dy = tbCanvas.y - canvasY;
            if (Math.sqrt(dx * dx + dy * dy) < 30) {
              return { toolName, annotationIndex: i, data: annotation };
            }
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }
  return null;
}

/**
 * Update annotation visual properties (color, line width).
 */
export function updateAnnotationStyle(
  element: HTMLElement,
  toolName: string,
  annotationIndex: number,
  style: { color?: string; lineWidth?: number }
): void {
  try {
    const state = cornerstoneTools.getToolState(element, toolName);
    if (!state?.data?.[annotationIndex]) return;

    const annotation = state.data[annotationIndex];
    if (style.color !== undefined) {
      annotation.color = style.color;
      annotation.activeColor = style.color;
      // Set on handles for some tools
      if (annotation.handles) {
        Object.keys(annotation.handles).forEach(key => {
          if (annotation.handles[key] && key !== 'textBox') {
            annotation.handles[key].drawnIndependently = false;
          }
        });
      }
    }
    if (style.lineWidth !== undefined) {
      // cornerstone-tools renderers always read from the global toolStyle.getToolWidth(),
      // not from per-annotation data. Set the global width so it takes effect.
      try {
        cornerstoneTools.toolStyle.setToolWidth(style.lineWidth);
        cornerstoneTools.toolStyle.setActiveWidth(style.lineWidth);
      } catch { /* ignore */ }
    }

    // Force re-render
    annotation.invalidated = true;
    cornerstone.updateImage(element);
  } catch { /* ignore */ }
}

/**
 * Scale an annotation (increase/decrease size) by a factor.
 * Works by moving handles relative to their center.
 */
export function scaleAnnotation(
  element: HTMLElement,
  toolName: string,
  annotationIndex: number,
  factor: number
): void {
  try {
    const state = cornerstoneTools.getToolState(element, toolName);
    if (!state?.data?.[annotationIndex]) return;

    const annotation = state.data[annotationIndex];
    const handles = annotation.handles;
    if (!handles) return;

    const handleKeys = Object.keys(handles).filter(k => k !== 'textBox');
    if (handleKeys.length < 2) return;

    // Find center of all handles
    let cx = 0, cy = 0, count = 0;
    handleKeys.forEach(key => {
      const h = handles[key];
      if (h?.x !== undefined && h?.y !== undefined) {
        cx += h.x; cy += h.y; count++;
      }
    });
    if (count === 0) return;
    cx /= count; cy /= count;

    // Scale each handle relative to center
    handleKeys.forEach(key => {
      const h = handles[key];
      if (h?.x !== undefined && h?.y !== undefined) {
        h.x = cx + (h.x - cx) * factor;
        h.y = cy + (h.y - cy) * factor;
      }
    });

    // Clear cached stats so they get recalculated
    if (annotation.cachedStats) {
      Object.keys(annotation.cachedStats).forEach(k => delete annotation.cachedStats[k]);
    }
    annotation.invalidated = true;

    cornerstone.updateImage(element);
  } catch { /* ignore */ }
}

/**
 * Delete a specific annotation.
 */
export function deleteAnnotation(
  element: HTMLElement,
  toolName: string,
  annotationIndex: number
): void {
  try {
    const state = cornerstoneTools.getToolState(element, toolName);
    if (!state?.data) return;
    state.data.splice(annotationIndex, 1);
    cornerstone.updateImage(element);
  } catch { /* ignore */ }
}

/**
 * Delete the currently active/selected annotation on an element.
 * Returns true if an annotation was deleted.
 */
export function deleteActiveAnnotationOnElement(element: HTMLElement): boolean {
  for (const toolName of ANNOTATION_TOOLS) {
    try {
      const state = cornerstoneTools.getToolState(element, toolName);
      if (!state?.data) continue;
      for (let i = state.data.length - 1; i >= 0; i--) {
        if (state.data[i].active) {
          state.data.splice(i, 1);
          cornerstone.updateImage(element);
          return true;
        }
      }
    } catch { /* ignore */ }
  }
  return false;
}

/**
 * Setup auto-deactivate: after a tool completes a measurement,
 * deactivate it and call the callback.
 * Returns cleanup function.
 */
export function setupAutoDeactivate(
  element: HTMLElement,
  onDeactivate: () => void
): () => void {
  const handler = (e: any) => {
    const toolName = e?.detail?.toolName || e?.detail?.toolType;
    if (toolName && ANNOTATION_TOOLS.includes(toolName)) {
      // Stamp a timestamp on the annotation for undo ordering
      try {
        const state = cornerstoneTools.getToolState(element, toolName);
        if (state?.data?.length > 0) {
          state.data[state.data.length - 1]._timestamp = Date.now();
        }
      } catch { /* ignore */ }

      // Deactivate the tool
      try { cornerstoneTools.setToolPassive(toolName); } catch { /* ignore */ }
      onDeactivate();
    }
  };

  element.addEventListener('cornerstonetoolsmeasurementcompleted', handler);
  element.addEventListener('cornerstonetoolsmeasurementadded', handler);
  return () => {
    element.removeEventListener('cornerstonetoolsmeasurementcompleted', handler);
    element.removeEventListener('cornerstonetoolsmeasurementadded', handler);
  };
}

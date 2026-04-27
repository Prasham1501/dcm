/**
 * Viewer Tool Management - Maps UI tool buttons to Cornerstone tool activations.
 * Each tool is independent — activating one cleanly deactivates others.
 * Thumbnails are NOT cornerstone-enabled, so global tool changes don't affect them.
 */
import { cornerstone, cornerstoneTools } from './cornerstoneSetup';
import { useCustomAnnotationStore } from '@/stores/customAnnotationStore';
import { useViewerStore } from '@/stores/viewerStore';

/** Active tool info */
export interface ToolConfig {
  /** cornerstoneTools tool name */
  csToolName?: string;
  /** Custom action (not a cornerstone tool) */
  action?: (element: HTMLDivElement) => void;
  /** Mouse button: 1=left, 2=middle, 4=right */
  mouseButtonMask?: number;
  /** If true, this tool is handled by custom JS (capture-phase) in DicomViewport */
  customHandler?: boolean;
}

/**
 * Get the currently selected/active main viewport element.
 */
function getActiveViewportElement(): HTMLDivElement | null {
  const viewports = document.querySelectorAll('[data-viewport-index]');
  if (viewports.length > 0) {
    return (viewports[0] as HTMLDivElement) || null;
  }
  return null;
}

/**
 * Map of our UI tool IDs to Cornerstone tool config.
 * Tools marked `customHandler: true` are handled by capture-phase events in DicomViewport.
 * Tools with `csToolName` are standard cornerstone tools activated globally.
 * Tools with `action` are one-shot actions (rotate, flip, etc).
 */
const TOOL_MAP: Record<string, ToolConfig> = {
  // Custom tools (DicomViewport handles these via capture-phase events)
  select: { customHandler: true }, // no tool active, just selection
  stamp: { customHandler: true },  // click-to-place stamp
  text: { customHandler: true },   // click-to-place text
  draw: { customHandler: true },   // hold-to-draw freehand
  polyline: { customHandler: true }, // hold-to-draw polyline

  // Standard cornerstone tools (activated globally via setToolActive)
  line: { csToolName: 'Length' },
  arrow: { csToolName: 'ArrowAnnotate' },
  measure: { csToolName: 'Length' },
  square: { csToolName: 'RectangleRoi' },
  ellipse: { csToolName: 'EllipticalRoi' },
  pan: { csToolName: 'Pan' },
  zoom: { csToolName: 'Zoom' },
  wl: { csToolName: 'Wwwc' },
  length: { csToolName: 'Length' },
  angle: { csToolName: 'Angle' },
  probe: { csToolName: 'Probe' },
  magnify: { csToolName: 'Magnify' },
  ellipticalroi: { csToolName: 'EllipticalRoi' },
  rectangleroi: { csToolName: 'RectangleRoi' },

  // One-shot actions
  '90cw': { action: (el) => rotateViewport(el, 90) },
  '90acw': { action: (el) => rotateViewport(el, -90) },
  fliph: { action: (el) => flipViewport(el, 'h') },
  flipv: { action: (el) => flipViewport(el, 'v') },
  invert: { action: invertViewport },
  settings: { action: handleOpenSettingsModal },
  filters: { action: handleFilters },
  reset: { action: resetViewport },
  undo: { action: undoLastAnnotation },
  cineplay: { action: startCineAction },
  cinestop: { action: stopCineAction },
};

/** Window/Level presets for different body parts */
export const WL_PRESETS: Record<string, { ww: number; wl: number }> = {
  default: { ww: 400, wl: 40 },
  lung: { ww: 1500, wl: -600 },
  abdomen: { ww: 400, wl: 50 },
  brain: { ww: 80, wl: 40 },
  bone: { ww: 2500, wl: 480 },
  softTissue: { ww: 350, wl: 50 },
};

/**
 * Set the color for annotation tools (text, arrows, measurements).
 */
export function setAnnotationToolColor(color: string): void {
  try {
    if (cornerstoneTools.toolColors) {
      cornerstoneTools.toolColors.setToolColor(color);
      cornerstoneTools.toolColors.setActiveColor(color);
    }
  } catch (err) {
    console.warn('[Tools] setAnnotationToolColor error:', err);
  }
}

/** All interactive cornerstone tool names that can be globally activated */
const ALL_CS_TOOLS = [
  'Pan', 'Zoom', 'Wwwc', 'Length', 'Angle', 'Probe',
  'EllipticalRoi', 'RectangleRoi', 'FreehandRoi',
  'ArrowAnnotate', 'TextMarker', 'Rotate', 'Magnify', 'DragProbe',
];

/**
 * Deactivate ALL cornerstone tools globally.
 * Sets each to passive (renders existing annotations but no mouse interaction).
 */
function deactivateAllCsTools(): void {
  ALL_CS_TOOLS.forEach((name) => {
    try { cornerstoneTools.setToolPassive(name); } catch { /* ignore */ }
  });
}

/**
 * Activate a tool by our UI tool ID.
 * - Actions: executed immediately (rotate, flip, etc.)
 * - Custom tools (stamp/text/draw/polyline/select): deactivate all CS tools, DicomViewport handles
 * - Standard CS tools (pan/zoom/length/etc.): activate via cornerstoneTools.setToolActive
 */
export function activateTool(toolId: string, element?: HTMLDivElement | null): void {
  const config = TOOL_MAP[toolId];
  if (!config) return;

  // One-shot actions: execute and return
  if (config.action) {
    const resolvedEl = element || getActiveViewportElement();
    config.action(resolvedEl || document.createElement('div'));
    return;
  }

  // Custom tools (stamp, text, draw, polyline, select):
  // Deactivate all cornerstone tools so they don't interfere with our custom handlers
  if (config.customHandler) {
    deactivateAllCsTools();
    return;
  }

  // Standard cornerstone tool activation:
  if (config.csToolName) {
    // First deactivate all CS tools
    deactivateAllCsTools();

    // Then activate the requested one
    try {
      cornerstoneTools.setToolActive(config.csToolName, {
        mouseButtonMask: config.mouseButtonMask || 1,
      });
    } catch (err) {
      console.warn('[Tools] Failed to activate:', config.csToolName, err);
    }
  }
}

/**
 * Apply a tool action to multiple viewport elements (for multi-select).
 */
export function applyActionToElements(toolId: string, elements: HTMLDivElement[]): void {
  const config = TOOL_MAP[toolId];
  if (!config?.action) return;
  elements.forEach((el) => {
    try { config.action!(el); } catch { /* ignore */ }
  });
}

/**
 * Rotate the viewport by the given degrees.
 */
export function rotateViewport(element: HTMLDivElement, degrees: number): void {
  try {
    const viewport = cornerstone.getViewport(element);
    if (viewport) {
      viewport.rotation = (viewport.rotation || 0) + degrees;
      cornerstone.setViewport(element, viewport);
    }
  } catch (err) {
    console.warn('[Tools] rotateViewport error:', err);
  }
}

/**
 * Flip the viewport horizontally or vertically.
 */
export function flipViewport(element: HTMLDivElement, direction: 'h' | 'v'): void {
  try {
    const viewport = cornerstone.getViewport(element);
    if (viewport) {
      if (direction === 'h') {
        viewport.hflip = !viewport.hflip;
      } else {
        viewport.vflip = !viewport.vflip;
      }
      cornerstone.setViewport(element, viewport);
    }
  } catch (err) {
    console.warn('[Tools] flipViewport error:', err);
  }
}

/**
 * Invert the viewport colors (negative).
 */
export function invertViewport(element: HTMLDivElement): void {
  try {
    const viewport = cornerstone.getViewport(element);
    if (viewport) {
      viewport.invert = !viewport.invert;
      cornerstone.setViewport(element, viewport);
    }
  } catch (err) {
    console.warn('[Tools] invertViewport error:', err);
  }
}

/**
 * Reset viewport to default (fit to window, original W/L, no rotation/flip/invert) and clear all annotations.
 */
export function resetViewport(element: HTMLDivElement): void {
  try {
    const enabledElement = cornerstone.getEnabledElement(element);
    const image = enabledElement?.image;
    if (image) {
      // Clear custom annotation store for this image BEFORE dispatching the sync event
      useCustomAnnotationStore.getState().clearForImageId(image.imageId);

      const wc = Array.isArray(image.windowCenter) ? image.windowCenter[0] : (image.windowCenter ?? 127);
      const ww = Array.isArray(image.windowWidth) ? image.windowWidth[0] : (image.windowWidth ?? 255);

      // Get the default fitted scale from cornerstone — this accounts for element dimensions
      let defaultScale = 1;
      try {
        const defaultVp = cornerstone.getDefaultViewportForImage(element, image);
        if (defaultVp?.scale) defaultScale = defaultVp.scale;
      } catch { /* ignore — fall back to scale 1 */ }

      // Explicitly pass a completely fresh viewport so cornerstone cannot reuse the modified one
      cornerstone.displayImage(element, image, {
        scale: defaultScale,
        translation: { x: 0, y: 0 },
        voi: { windowCenter: wc, windowWidth: ww },
        rotation: 0,
        hflip: false,
        vflip: false,
        invert: false,
        pixelReplication: false,
        labelmap: false,
      });

      // Update store W/L / zoom sliders
      try {
        const { setLevel, setWidth, setZoom } = useViewerStore.getState();
        setLevel(Math.round(wc));
        setWidth(Math.round(ww));
        setZoom(defaultScale);
      } catch { /* ignore */ }
    }
  } catch (err) {
    console.warn('[Tools] resetViewport error:', err);
  }
  // Clear cornerstone tool annotations (Length, Angle, ROI, etc.)
  clearAnnotations(element);
  // Dispatch event so DicomViewport re-syncs its custom annotation display (now cleared above)
  window.dispatchEvent(new CustomEvent('dicom-clear-annotations', { detail: { element } }));
}

/**
 * Apply a window/level preset.
 */
export function applyWLPreset(element: HTMLDivElement, preset: string): void {
  const values = WL_PRESETS[preset];
  if (!values) return;
  try {
    const viewport = cornerstone.getViewport(element);
    if (viewport) {
      viewport.voi = { windowWidth: values.ww, windowCenter: values.wl };
      cornerstone.setViewport(element, viewport);
    }
  } catch (err) {
    console.warn('[Tools] applyWLPreset error:', err);
  }
}

/**
 * Set window/level directly.
 */
export function setWindowLevel(element: HTMLDivElement, ww: number, wl: number): void {
  try {
    const viewport = cornerstone.getViewport(element);
    if (viewport) {
      viewport.voi = { windowWidth: ww, windowCenter: wl };
      cornerstone.setViewport(element, viewport);
    }
  } catch (err) {
    console.warn('[Tools] setWindowLevel error:', err);
  }
}

/**
 * Set zoom level.
 */
export function setZoom(element: HTMLDivElement, scale: number): void {
  try {
    const viewport = cornerstone.getViewport(element);
    if (viewport) {
      viewport.scale = scale;
      cornerstone.setViewport(element, viewport);
    }
  } catch (err) {
    console.warn('[Tools] setZoom error:', err);
  }
}

/**
 * Get current viewport state.
 */
export function getViewportState(element: HTMLDivElement) {
  try {
    return cornerstone.getViewport(element);
  } catch {
    return null;
  }
}

/**
 * Clear all annotations from the element.
 */
export function clearAnnotations(element: HTMLDivElement): void {
  const toolNames = [
    'Length', 'Angle', 'EllipticalRoi', 'RectangleRoi',
    'FreehandRoi', 'ArrowAnnotate', 'TextMarker', 'Probe',
  ];
  toolNames.forEach((name) => {
    try {
      const state = cornerstoneTools.getToolState(element, name);
      if (state && state.data) {
        state.data.length = 0;
      }
    } catch {
      // ignore
    }
  });
  try {
    cornerstone.updateImage(element);
  } catch {
    // ignore
  }
}

/**
 * Settings: Dispatches event to open the Settings Modal.
 */
function handleOpenSettingsModal(_element: HTMLDivElement) {
  const event = new CustomEvent('dicom-open-settings-modal');
  window.dispatchEvent(event);
}

/**
 * Filters: Dispatches event to open the filters dialog.
 */
function handleFilters(_element: HTMLDivElement) {
  const event = new CustomEvent('dicom-open-filters');
  window.dispatchEvent(event);
}

/**
 * Apply a brightness/contrast filter to the viewport.
 */
export function applyFilter(element: HTMLDivElement, filter: 'sharpen' | 'smooth' | 'edge' | 'none'): void {
  try {
    const viewport = cornerstone.getViewport(element);
    if (!viewport) return;

    switch (filter) {
      case 'sharpen':
        viewport.voi = {
          windowWidth: (viewport.voi?.windowWidth || 400) * 0.7,
          windowCenter: viewport.voi?.windowCenter || 40,
        };
        break;
      case 'smooth':
        viewport.voi = {
          windowWidth: (viewport.voi?.windowWidth || 400) * 1.5,
          windowCenter: viewport.voi?.windowCenter || 40,
        };
        break;
      case 'edge':
        viewport.voi = {
          windowWidth: Math.min(viewport.voi?.windowWidth || 400, 100),
          windowCenter: viewport.voi?.windowCenter || 40,
        };
        break;
      case 'none':
        try {
          const enabledElement = cornerstone.getEnabledElement(element);
          if (enabledElement.image) {
            viewport.voi = {
              windowWidth: enabledElement.image.windowWidth,
              windowCenter: enabledElement.image.windowCenter
            };
          } else {
            viewport.voi = { windowWidth: 400, windowCenter: 40 };
          }
        } catch {
          viewport.voi = { windowWidth: 400, windowCenter: 40 };
        }
        break;
    }
    cornerstone.setViewport(element, viewport);
  } catch (err) {
    console.warn('[Tools] applyFilter error:', err);
  }
}

/**
 * Capture the current viewport as a data URL (for printing/export).
 */
export function captureViewportAsDataUrl(element: HTMLDivElement): string | null {
  try {
    const canvas = element.querySelector('canvas');
    if (canvas) {
      return canvas.toDataURL('image/png');
    }
  } catch (err) {
    console.warn('[Tools] captureViewport error:', err);
  }
  return null;
}

/**
 * Capture all viewport canvases on the page as data URLs.
 */
export function captureAllViewports(): string[] {
  const { images, currentPage, currentLayout, viewportImageOverrides } = useViewerStore.getState();
  const startIndex = (currentPage - 1) * currentLayout.spots;
  const result: string[] = [];
  const viewports = document.querySelectorAll('[data-viewport-index]');
  viewports.forEach((el) => {
    const vpIndex = parseInt((el as HTMLElement).getAttribute('data-viewport-index') || '0');
    const imgIndex = startIndex + vpIndex;
    const overrideUrl = viewportImageOverrides[vpIndex];
    const hasImage = !!(overrideUrl || images[imgIndex]?.imageUrl);
    if (!hasImage) {
      result.push('');
      return;
    }
    const canvas = el.querySelector('canvas');
    if (canvas) {
      try {
        result.push(canvas.toDataURL('image/png'));
      } catch {
        result.push('');
      }
    } else {
      result.push('');
    }
  });
  return result;
}

/**
 * Clear all annotations from the currently selected viewport(s).
 */
export function clearAllAnnotationsOnSelected(): void {
  const { selectedViewportIndices } = useViewerStore.getState();
  const elements = selectedViewportIndices
    .map((i: number) => document.querySelector(`[data-viewport-index="${i}"]`) as HTMLDivElement)
    .filter(Boolean);

  if (elements.length === 0) {
    const el = getActiveViewportElement();
    if (el) elements.push(el);
  }

  // Clear custom annotation store for each selected viewport's image FIRST
  // (must happen before dicom-clear-annotations is dispatched so the re-sync reads empty state)
  elements.forEach((el: HTMLDivElement) => {
    try {
      const enabledEl = cornerstone.getEnabledElement(el);
      const imageId = enabledEl?.image?.imageId;
      if (imageId) useCustomAnnotationStore.getState().clearForImageId(imageId);
    } catch { /* ignore */ }
  });

  elements.forEach((el: HTMLDivElement) => {
    clearAnnotations(el);
    window.dispatchEvent(new CustomEvent('dicom-clear-annotations', { detail: { element: el } }));
  });
}

/**
 * Delete the currently active/selected annotation from selected viewport(s).
 * Returns true if any annotation was deleted.
 */
export function deleteActiveAnnotationOnSelected(): boolean {
  const { deleteActiveAnnotationOnElement } = require('@/lib/annotationUtils');
  const { selectedViewportIndices } = useViewerStore.getState();
  const elements = selectedViewportIndices
    .map((i: number) => document.querySelector(`[data-viewport-index="${i}"]`) as HTMLDivElement)
    .filter(Boolean);

  if (elements.length === 0) {
    const el = getActiveViewportElement();
    if (el) elements.push(el);
  }

  for (const el of elements) {
    if (deleteActiveAnnotationOnElement(el)) return true;
  }
  return false;
}

// Declare global stamp text
declare global {
  interface Window {
    __dicomStampText?: string;
    __pendingStampText?: string;
    __cropMode?: boolean;
    __scaleOverlayActive?: boolean;
  }
}

/**
 * Undo the last annotation on the active viewport element.
 * Tracks annotation counts per tool to detect which tool had the most recent addition.
 */
const prevToolCounts = new Map<string, number>();

function undoLastAnnotation(element: HTMLDivElement): void {
  const toolNames = [
    'Length', 'Angle', 'EllipticalRoi', 'RectangleRoi',
    'FreehandRoi', 'ArrowAnnotate', 'TextMarker', 'Probe',
  ];

  // Find which tool gained an annotation since last call (most recently added)
  let newestTool = '';
  let newestGain = 0;

  toolNames.forEach((name) => {
    try {
      const state = cornerstoneTools.getToolState(element, name);
      if (state && state.data && state.data.length > 0) {
        const prevCount = prevToolCounts.get(name) || 0;
        const gain = state.data.length - prevCount;
        if (gain > newestGain) {
          newestGain = gain;
          newestTool = name;
        }
        // If no gains detected, fall back to any tool with data
        if (!newestTool) newestTool = name;
      }
    } catch { /* ignore */ }
  });

  if (newestTool) {
    try {
      const state = cornerstoneTools.getToolState(element, newestTool);
      if (state?.data?.length > 0) {
        state.data.pop();
        // Update tracked counts
        toolNames.forEach((name) => {
          try {
            const s = cornerstoneTools.getToolState(element, name);
            prevToolCounts.set(name, s?.data?.length || 0);
          } catch { /* ignore */ }
        });
        cornerstone.updateImage(element);
      }
    } catch { /* ignore */ }
  }
}

/**
 * Undo annotation on the currently selected viewport (for keyboard shortcut).
 */
export function undoLastAnnotationOnSelected(): void {
  const el = getActiveViewportElement();
  if (el) undoLastAnnotation(el);
}

/**
 * Cine: Start playback via viewerStore.
 */
function startCineAction(_element: HTMLDivElement): void {
  try {
    const store = useViewerStore.getState();
    store.setShowCine(true);
    store.startCine();
  } catch (err) {
    console.warn('[Tools] startCine error:', err);
  }
}

/**
 * Cine: Stop playback via viewerStore.
 */
function stopCineAction(_element: HTMLDivElement): void {
  try {
    const store = useViewerStore.getState();
    store.stopCine();
  } catch (err) {
    console.warn('[Tools] stopCine error:', err);
  }
}

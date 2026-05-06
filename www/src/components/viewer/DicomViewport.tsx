/**
 * DicomViewport - Renders a single DICOM image using Cornerstone.js.
 * Custom mouse controls: scroll=zoom, right-drag=W/L, left-click=tool.
 * Supports text/stamp annotations (HTML overlays) and hold-to-draw (canvas overlay).
 * Uses capture-phase events so stamp/text always work even when cornerstone tools were used.
 */
import { useEffect, useRef, useCallback, memo, useState } from 'react';
import { createPortal } from 'react-dom';
import { cornerstone, cornerstoneTools } from '@/lib/cornerstoneSetup';
import { useViewerStore } from '@/stores/viewerStore';
import { useCustomAnnotationStore, type TextAnnotation, type DrawPath } from '@/stores/customAnnotationStore';
import { useStampStore } from '@/stores/stampStore';
import { resetViewport, activateTool } from '@/lib/viewerTools';
import { refitCornerstoneViewport } from '@/lib/cornerstoneViewport';
import { findAnnotationAtPoint, setupAutoDeactivate, markDblClickHandled } from '@/lib/annotationUtils';
import { AnnotationEditOverlay } from '@/components/shared/AnnotationEditOverlay';
import { X, Plus, Minus, Trash2, Check } from 'lucide-react';


// ---- Draw path annotation ---- (interfaces moved to store)

// ---- Component ----
interface DicomViewportProps {
  imageId: string | null;
  isSelected: boolean;
  isMultiSelected?: boolean;
  onClick: (e: React.MouseEvent) => void;
  viewportIndex: number;
  activeTool?: string;
  imageStack?: string[];
  stackIndex?: number;
  onImageDrop?: (imageUrl: string) => void;
}

function DicomViewportInner({
  imageId,
  isSelected,
  isMultiSelected = false,
  onClick,
  viewportIndex,
  activeTool,
  imageStack,
  stackIndex,
  onImageDrop,
}: DicomViewportProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const enabledRef = useRef(false);
  const currentImageIdRef = useRef<string | null>(null);
  const pendingLayoutRefitRef = useRef(false);
  const layoutKey = useViewerStore((state) => state.currentLayout.id || `${state.currentLayout.cols}x${state.currentLayout.rows}-${state.currentLayout.spots}`);

  // Right-click W/L drag state
  const rightButtonDownRef = useRef(false);
  const rightDragRef = useRef<{
    startX: number;
    startY: number;
    startWW: number;
    startWC: number;
  } | null>(null);

  // Left-click pan drag state
  const panDragRef = useRef<{
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
  } | null>(null);

  // Text annotation UI state (pending additions)
  const [pendingInput, setPendingInput] = useState<{
    xPercent: number;
    yPercent: number;
    type: 'text' | 'stamp';
  } | null>(null);
  const [inputText, setInputText] = useState('');
  const [inputColor, setInputColor] = useState('#ffff00');
  const [inputFontSize, setInputFontSize] = useState(14);
  const inputRef = useRef<HTMLInputElement>(null);

  // Editing an existing annotation (double-click)
  const [editingAnn, setEditingAnn] = useState<TextAnnotation | null>(null);
  const [editColor, setEditColor] = useState('#ffff00');
  const [editFontSize, setEditFontSize] = useState(14);

  // Editing cornerstone annotation (double-click on shape)
  const [editingCSAnnotation, setEditingCSAnnotation] = useState<{
    toolName: string; annotationIndex: number; color: string; lineWidth: number; position: { x: number; y: number };
  } | null>(null);

  // Drag state for move existing annotations
  const [draggingAnn, setDraggingAnn] = useState<{
    id: string;
    startX: number;
    startY: number;
    startXPct: number;
    startYPct: number;
  } | null>(null);

  // Draw/polyline state (isDrawingRef and currentDrawPathRef remain local for performance)
  const isDrawingRef = useRef(false);
  const currentDrawPathRef = useRef<{ x: number; y: number }[]>([]);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);

  // Store actions (non-reactive)
  const { 
    addText, removeText, updateText, 
    addPath, removePath 
  } = useCustomAnnotationStore();

  // Read annotations/drawPaths directly from the zustand store via selectors.
  // This eliminates stale-state bugs: when imageId changes (e.g. after
  // double-click expand/restore), the selector immediately returns the correct
  // data for the NEW imageId — no local state to go stale.
  const annotations = useCustomAnnotationStore(
    (s) => imageId ? (s.annotations[imageId] || []) : []
  );
  const drawPaths = useCustomAnnotationStore(
    (s) => imageId ? (s.drawPaths[imageId] || []) : []
  );

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const rightClickMoved = useRef(false);

  const runLayoutRefit = useCallback(() => {
    const el = elementRef.current;
    if (!el || !enabledRef.current || !currentImageIdRef.current) return false;
    return refitCornerstoneViewport(el);
  }, []);

  /**
   * Compute fontSizePercent from an absolute px size using the current
   * container height. Falls back to a sensible default (2.5 cqh) when
   * the container is not yet laid out.
   */
  const pxToFontSizePercent = useCallback((px: number): number => {
    const h = containerRef.current?.clientHeight;
    if (!h || h < 10) return 2.5;
    return (px / h) * 100;
  }, []);

  /** Resolve the effective cqh value for a TextAnnotation. */
  const getEffectiveFontSizePercent = useCallback((ann: TextAnnotation): number => {
    if (ann.fontSizePercent && ann.fontSizePercent > 0) return ann.fontSizePercent;
    return pxToFontSizePercent(ann.fontSize);
  }, [pxToFontSizePercent]);

  // Reset pending input when imageId changes
  const prevImageIdRef = useRef<string | null>(null);
  if (imageId !== prevImageIdRef.current) {
    prevImageIdRef.current = imageId;
    setPendingInput(null);
    isDrawingRef.current = false;
  }

  // Focus input when it appears
  useEffect(() => {
    if (pendingInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [pendingInput]);

  // Enable cornerstone on mount
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    try {
      cornerstone.enable(el);
      enabledRef.current = true;
    } catch { /* may already be enabled */ }
    return () => {
      if (enabledRef.current && el) {
        try { cornerstone.disable(el); } catch { /* ignore */ }
        enabledRef.current = false;
      }
    };
  }, []);

  // Sync viewport state (W/L, zoom, pan) back to store and to all selected viewports
  // This catches changes made by cornerstone tools (Wwwc, Zoom, Pan) interactively
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const handleImageRendered = () => {
      if (!enabledRef.current) return;
      const { selectedViewport, selectedViewportIndices, setLevel, setWidth, setZoom } = useViewerStore.getState();
      // Only sync from the primary selected viewport to avoid conflicts
      if (viewportIndex !== selectedViewport) return;
      try {
        const vp = cornerstone.getViewport(el);
        if (vp) {
          if (vp.voi) {
            setLevel(Math.round(vp.voi.windowCenter));
            setWidth(Math.round(vp.voi.windowWidth));
          }
          if (vp.scale) {
            setZoom(vp.scale);
          }
          // Dispatch full sync event so other selected viewports apply same zoom/pan/W-L to their own element
          if (selectedViewportIndices.length > 1) {
            window.dispatchEvent(new CustomEvent('dicom-viewport-sync', {
              detail: {
                type: 'full',
                sourceIndex: viewportIndex,
                scale: vp.scale,
                translation: { x: vp.translation?.x ?? 0, y: vp.translation?.y ?? 0 },
                windowWidth: vp.voi?.windowWidth,
                windowCenter: vp.voi?.windowCenter,
              },
            }));
          }
        }
      } catch { /* ignore */ }
    };

    el.addEventListener('cornerstoneimagerendered', handleImageRendered);
    return () => el.removeEventListener('cornerstoneimagerendered', handleImageRendered);
  }, [viewportIndex]);

  // ---- AUTO-DEACTIVATE TOOLS AFTER SINGLE USE ----
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    return setupAutoDeactivate(el, () => {
      window.dispatchEvent(new CustomEvent('viewer-tool-deactivated'));
    }, 'viewer');
  }, []);

  // ---- DOUBLE-CLICK TO EDIT CORNERSTONE ANNOTATIONS ----
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    const handleDblClick = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const found = findAnnotationAtPoint(el, canvasX, canvasY);
      if (found) {
        e.stopPropagation();
        markDblClickHandled();
        setEditingCSAnnotation({
          toolName: found.toolName,
          annotationIndex: found.annotationIndex,
          color: found.data.color || '#00ff00',
          lineWidth: found.data.lineWidth || 1,
          position: { x: e.clientX, y: e.clientY },
        });
      }
    };
    el.addEventListener('dblclick', handleDblClick);
    return () => el.removeEventListener('dblclick', handleDblClick);
  }, []);

  // Listen for clear-annotations event — cancel in-progress drawing
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const targetEl = detail?.element;
      if (!targetEl || targetEl === elementRef.current) {
        // Store is already cleared by resetAll(); annotations/drawPaths
        // selectors will return [] automatically on re-render.
        isDrawingRef.current = false;
        currentDrawPathRef.current = [];
        const canvas = drawCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    };
    window.addEventListener('dicom-clear-annotations', handler);
    return () => window.removeEventListener('dicom-clear-annotations', handler);
  }, []);

  // Load image when imageId changes
  useEffect(() => {
    const el = elementRef.current;
    if (!el || !enabledRef.current) return;

    if (!imageId) {
      currentImageIdRef.current = null;
      return;
    }

    if (currentImageIdRef.current === imageId) return;
    let cancelled = false;

    cornerstone.loadImage(imageId).then(
      (image: any) => {
        if (cancelled || !enabledRef.current) return;
        try {
          cornerstone.displayImage(el, image);
          currentImageIdRef.current = imageId;

          if (image.columns && image.rows) {
            useViewerStore.getState().setImageAspectRatio(image.columns / image.rows);
          }

          if (viewportIndex === 0) {
            const wc = image.windowCenter ?? 127;
            const ww = image.windowWidth ?? 255;
            const { setLevel, setWidth } = useViewerStore.getState();
            setLevel(Array.isArray(wc) ? wc[0] : wc);
            setWidth(Array.isArray(ww) ? ww[0] : ww);
          }

          if (imageStack && imageStack.length > 0) {
            const stack = {
              currentImageIdIndex: stackIndex ?? 0,
              imageIds: imageStack,
            };
            cornerstoneTools.addStackStateManager(el, ['stack']);
            cornerstoneTools.addToolState(el, 'stack', stack);
          }

          cornerstone.resize(el, true);
        } catch (err) {
          console.warn('[Viewport] displayImage error:', err);
        }
      },
      (err: any) => {
        if (!cancelled) {
          console.warn('[Viewport] loadImage failed:', imageId, err?.message || err);
        }
      }
    );

    return () => { cancelled = true; };
  }, [imageId, imageStack, stackIndex, viewportIndex]);

  // Handle resize
  useEffect(() => {
    const el = elementRef.current;
    if (!el || !enabledRef.current) return;
    const observer = new ResizeObserver(() => {
      // Also resize draw canvas
      const canvas = drawCanvasRef.current;
      if (canvas && el.parentElement) {
        canvas.width = el.parentElement.clientWidth;
        canvas.height = el.parentElement.clientHeight;
      }

      if (!currentImageIdRef.current) return;

      if (pendingLayoutRefitRef.current) {
        if (runLayoutRefit()) pendingLayoutRefitRef.current = false;
        return;
      }

      try { cornerstone.resize(el, true); } catch { /* ignore */ }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [runLayoutRefit]);

  useEffect(() => {
    pendingLayoutRefitRef.current = true;
    const timeoutId = window.setTimeout(() => {
      if (pendingLayoutRefitRef.current && runLayoutRefit()) {
        pendingLayoutRefitRef.current = false;
      }
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [layoutKey, runLayoutRefit]);

  // ---- MOUSE WHEEL = ZOOM ----
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!enabledRef.current) return;

      try {
        const viewport = cornerstone.getViewport(el);
        if (!viewport) return;
        const zoomSensitivity = 0.002;
        const zoomDirection = e.deltaY > 0 ? -1 : 1;
        const zoomFactor = 1 + (zoomDirection * zoomSensitivity * Math.abs(e.deltaY));
        const newScale = Math.max(0.1, Math.min(10, viewport.scale * zoomFactor));
        viewport.scale = newScale;
        cornerstone.setViewport(el, viewport);
        useViewerStore.getState().setZoom(newScale);

        const { selectedViewportIndices } = useViewerStore.getState();
        if (selectedViewportIndices.length > 1 && selectedViewportIndices.includes(viewportIndex)) {
          // Broadcast zoom only for true multi-select interactions.
          window.dispatchEvent(new CustomEvent('dicom-viewport-sync', {
            detail: { type: 'scale', sourceIndex: viewportIndex, scale: newScale },
          }));
        }
      } catch { /* ignore */ }
    };

    parent.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => parent.removeEventListener('wheel', handleWheel, true);
  }, []);

  // ---- RECEIVE SYNC EVENTS FROM OTHER SELECTED VIEWPORTS ----
  // Each viewport handles its OWN cornerstone element — no cross-component DOM queries needed.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.sourceIndex === viewportIndex) return;
      const el = elementRef.current;
      if (!el || !enabledRef.current) return;
      // Only apply if this viewport is in the multi-select
      const { selectedViewportIndices } = useViewerStore.getState();
      if (selectedViewportIndices.length <= 1 || !selectedViewportIndices.includes(viewportIndex)) return;
      try {
        const vp = cornerstone.getViewport(el);
        if (!vp) return;
        if (detail.type === 'scale') {
          vp.scale = detail.scale;
        } else if (detail.type === 'voi') {
          vp.voi = { windowWidth: detail.windowWidth, windowCenter: detail.windowCenter };
        } else if (detail.type === 'translation') {
          vp.translation = detail.translation;
        } else if (detail.type === 'scale+translation') {
          vp.scale = detail.scale;
          vp.translation = detail.translation;
        } else if (detail.type === 'full') {
          vp.scale = detail.scale;
          vp.translation = detail.translation;
          if (detail.windowWidth != null && detail.windowCenter != null) {
            vp.voi = { windowWidth: detail.windowWidth, windowCenter: detail.windowCenter };
          }
        }
        cornerstone.setViewport(el, vp);
      } catch { /* ignore */ }
    };
    window.addEventListener('dicom-viewport-sync', handler);
    return () => window.removeEventListener('dicom-viewport-sync', handler);
  }, [viewportIndex]);

  // ---- RIGHT-CLICK DRAG = WINDOW/LEVEL, LEFT-DRAG = PAN ----
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const el = elementRef.current;
      if (!el || !enabledRef.current) return;

      // Right-click W/L drag
      if (rightDragRef.current) {
        const dx = e.clientX - rightDragRef.current.startX;
        const dy = e.clientY - rightDragRef.current.startY;
        // Mark as dragged if moved more than 3px (to distinguish from right-click)
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) rightClickMoved.current = true;
        const newWW = Math.max(1, rightDragRef.current.startWW + dx * 3.0);
        const newWC = rightDragRef.current.startWC + dy * 2.0;

        try {
          const viewport = cornerstone.getViewport(el);
          if (viewport) {
            viewport.voi = { windowWidth: newWW, windowCenter: newWC };
            cornerstone.setViewport(el, viewport);
            useViewerStore.getState().setWidth(Math.round(newWW));
            useViewerStore.getState().setLevel(Math.round(newWC));

            const { selectedViewportIndices } = useViewerStore.getState();
            if (selectedViewportIndices.length > 1 && selectedViewportIndices.includes(viewportIndex)) {
              // Broadcast W/L only for true multi-select interactions.
              window.dispatchEvent(new CustomEvent('dicom-viewport-sync', {
                detail: { type: 'voi', sourceIndex: viewportIndex, windowWidth: newWW, windowCenter: newWC },
              }));
            }
          }
        } catch { /* ignore */ }
        return;
      }

      // Left-click pan drag
      if (panDragRef.current) {
        const dx = e.clientX - panDragRef.current.startX;
        const dy = e.clientY - panDragRef.current.startY;

        try {
          const viewport = cornerstone.getViewport(el);
          if (viewport) {
            viewport.translation = {
              x: panDragRef.current.startTx + dx,
              y: panDragRef.current.startTy + dy,
            };
            cornerstone.setViewport(el, viewport);

            const { selectedViewportIndices } = useViewerStore.getState();
            if (selectedViewportIndices.length > 1 && selectedViewportIndices.includes(viewportIndex)) {
              // Broadcast pan only for true multi-select interactions.
              window.dispatchEvent(new CustomEvent('dicom-viewport-sync', {
                detail: {
                  type: 'translation',
                  sourceIndex: viewportIndex,
                  translation: { x: panDragRef.current!.startTx + dx, y: panDragRef.current!.startTy + dy },
                },
              }));
            }
          }
        } catch { /* ignore */ }
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        // Context menu is now handled by onContextMenu event
        rightDragRef.current = null;
        rightButtonDownRef.current = false;
        document.body.style.cursor = '';
      }
      if (e.button === 0) {
        panDragRef.current = null;
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // ---- ANNOTATION DRAGGING ----
  // During drag we override the position locally for smooth rendering,
  // then commit to the store on mouseup.
  const [dragPositionOverride, setDragPositionOverride] = useState<{
    id: string; xPercent: number; yPercent: number;
  } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingAnn || !imageId) return;
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const dx = ((e.clientX - draggingAnn.startX) / rect.width) * 100;
      const dy = ((e.clientY - draggingAnn.startY) / rect.height) * 100;

      const newXPct = Math.max(0, Math.min(100, draggingAnn.startXPct + dx));
      const newYPct = Math.max(0, Math.min(100, draggingAnn.startYPct + dy));

      setDragPositionOverride({ id: draggingAnn.id, xPercent: newXPct, yPercent: newYPct });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (draggingAnn && imageId) {
        const ann = annotations.find(a => a.id === draggingAnn.id);
        if (ann) {
          const rect = containerRef.current!.getBoundingClientRect();
          const dx = ((e.clientX - draggingAnn.startX) / rect.width) * 100;
          const dy = ((e.clientY - draggingAnn.startY) / rect.height) * 100;
          const finalXPct = Math.max(0, Math.min(100, draggingAnn.startXPct + dx));
          const finalYPct = Math.max(0, Math.min(100, draggingAnn.startYPct + dy));

          const updatedAnn = { ...ann, xPercent: finalXPct, yPercent: finalYPct };
          updateText(imageId, updatedAnn, ann);
          placeTextOnAllSelectedViewports(imageId, updatedAnn);
        }
        setDraggingAnn(null);
        setDragPositionOverride(null);
      }
    };

    if (draggingAnn) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingAnn, imageId, annotations]);

  // ---- DRAW CANVAS HELPERS ----
  const redrawCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw in-progress path
    if (isDrawingRef.current && currentDrawPathRef.current.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pts = currentDrawPathRef.current;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    }
  }, []);

  // ---- CAPTURE-PHASE NATIVE EVENT HANDLER ----
  // This fires BEFORE cornerstone-tools event listeners, ensuring
  // stamp/text/draw/polyline always work even when cornerstone tools were previously used.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleCaptureMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // only left click

      // Skip if the click is inside a pending input popup (stamp presets, text input, OK/Cancel buttons).
      // Without this check, clicking OK/Cancel would create a NEW pending input at the button position.
      const target = e.target as HTMLElement;
      if (target.closest('[data-pending-input]')) return;
      if (target.closest('[data-stamp-edit]')) return;
      if (target.closest('[data-annotation-overlay]')) return;
      if (editingAnn) return;

      const tool = useViewerStore.getState().activeToolId;

      // ---- STAMP ----
      if (tool === 'stamp' && imageId) {
        e.stopPropagation();
        e.preventDefault();
        const selectedStamp = useStampStore.getState().getSelectedStamp();
        if (!selectedStamp) {
          // No stamp selected — open stamp picker by showing pending input for text mode
          const rect = container.getBoundingClientRect();
          const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
          const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
          setPendingInput({ xPercent, yPercent, type: 'stamp' });
          setInputText('');
          return;
        }
        // Immediately place the selected stamp
        const rect = container.getBoundingClientRect();
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
        const newAnn: TextAnnotation = {
          id: `ann-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          text: selectedStamp.text,
          xPercent, yPercent,
          color: selectedStamp.color,
          fontSize: selectedStamp.fontSize,
          fontSizePercent: pxToFontSizePercent(selectedStamp.fontSize),
          type: 'stamp',
        };
        addText(imageId, newAnn);
        placeTextOnAllSelectedViewports(imageId, newAnn);
        useViewerStore.getState().setActiveTool('');
        return;
      }

      // ---- TEXT ----
      if (tool === 'text' && imageId) {
        e.stopPropagation();
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
        setPendingInput({ xPercent, yPercent, type: 'text' });
        setInputText('');
        setInputColor('#ffff00');
        setInputFontSize(14);
        return;
      }

      // ---- DRAW / POLYLINE (hold to draw) ----
      if ((tool === 'draw' || tool === 'polyline') && imageId) {
        e.stopPropagation();
        e.preventDefault();
        isDrawingRef.current = true;
        const rect = container.getBoundingClientRect();
        currentDrawPathRef.current = [{ x: e.clientX - rect.left, y: e.clientY - rect.top }];
        redrawCanvas();
        return;
      }
    };

    const handleCaptureMouseMove = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;
      const tool = useViewerStore.getState().activeToolId;
      if (tool !== 'draw' && tool !== 'polyline') return;
      const rect = container.getBoundingClientRect();
      currentDrawPathRef.current.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      redrawCanvas();
    };

    const handleCaptureMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      const pts = [...currentDrawPathRef.current];
      currentDrawPathRef.current = [];

      // Clear drawing canvas
      const canvas = drawCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }

      if (pts.length > 2 && imageId) {
        // Normalize to percentages for storage
        const rect = container.getBoundingClientRect();
        const pctPoints = pts.map((p) => ({
          x: (p.x / rect.width) * 100,
          y: (p.y / rect.height) * 100,
        }));

        const newPath: DrawPath = {
          id: `path-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          points: pctPoints,
          color: '#ffff00',
          strokeWidth: 2,
        };
        addPath(imageId, newPath);

        // Notify other selected viewports
        placeOnAllSelectedViewports(imageId, newPath);
      }
    };

    container.addEventListener('mousedown', handleCaptureMouseDown, { capture: true });
    container.addEventListener('mousemove', handleCaptureMouseMove, { capture: true });
    container.addEventListener('mouseup', handleCaptureMouseUp, { capture: true });

    return () => {
      container.removeEventListener('mousedown', handleCaptureMouseDown, true);
      container.removeEventListener('mousemove', handleCaptureMouseMove, true);
      container.removeEventListener('mouseup', handleCaptureMouseUp, true);
    };
  }, [imageId, redrawCanvas]);

  // ---- MULTI-VIEWPORT ANNOTATION HELPERS ----
  // Both helpers must filter against currentLayout.spots: stale indices from a
  // prior larger layout would otherwise resolve to whatever cornerstone element
  // happens to live at that DOM position, writing the annotation onto an image
  // the user did not target.
  function getValidPropagationIndices(): number[] {
    const { selectedViewportIndices, currentLayout } = useViewerStore.getState();
    if (selectedViewportIndices.length <= 1) return [];
    return selectedViewportIndices.filter((i) => i >= 0 && i < currentLayout.spots && i !== viewportIndex);
  }

  function placeOnAllSelectedViewports(sourceImageId: string, drawPath: DrawPath) {
    const targetIndices = getValidPropagationIndices();
    if (targetIndices.length === 0) return;

    targetIndices.forEach((vpIdx) => {
      const vpEl = document.querySelector(`[data-viewport-index="${vpIdx}"]`) as HTMLDivElement;
      if (!vpEl) return;
      try {
        const cs = (window as any).__cornerstone;
        if (cs) {
          const enabled = cs.getEnabledElement(vpEl);
          const targetImageId = enabled?.image?.imageId;
          if (targetImageId && targetImageId !== sourceImageId) {
            addPath(targetImageId, { ...drawPath, id: `path-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` }, false);
            window.dispatchEvent(new CustomEvent('dicom-annotations-updated', { detail: { imageId: targetImageId } }));
          }
        }
      } catch { /* ignore */ }
    });
  }

  function placeTextOnAllSelectedViewports(sourceImageId: string, ann: TextAnnotation) {
    const targetIndices = getValidPropagationIndices();
    if (targetIndices.length === 0) return;

    targetIndices.forEach((vpIdx) => {
      const vpEl = document.querySelector(`[data-viewport-index="${vpIdx}"]`) as HTMLDivElement;
      if (!vpEl) return;
      try {
        const cs = (window as any).__cornerstone;
        if (cs) {
          const enabled = cs.getEnabledElement(vpEl);
          const targetImageId = enabled?.image?.imageId;
          if (targetImageId && targetImageId !== sourceImageId) {
            addText(targetImageId, { ...ann, id: `ann-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` }, false);
            window.dispatchEvent(new CustomEvent('dicom-annotations-updated', { detail: { imageId: targetImageId } }));
          }
        }
      } catch { /* ignore */ }
    });
  }

  // ---- CUSTOM CONTEXT MENU (fires reliably on right-click) ----
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // Only show if no W/L drag occurred (moved < 3px)
    if (!rightClickMoved.current) {
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
    rightButtonDownRef.current = false;
    rightDragRef.current = null;
    document.body.style.cursor = '';
  }, []);
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Close context menu on any click
    if (contextMenu) setContextMenu(null);

    if (e.button === 2) {
      e.preventDefault();
      rightClickMoved.current = false;
      rightButtonDownRef.current = true;
      const el = elementRef.current;
      if (!el || !enabledRef.current) return;
      try {
        const viewport = cornerstone.getViewport(el);
        if (viewport) {
          rightDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startWW: viewport.voi?.windowWidth || 255,
            startWC: viewport.voi?.windowCenter || 127,
          };
          document.body.style.cursor = 'ew-resize';
        }
      } catch { /* ignore */ }
    } else if (e.button === 0) {
      // Only call onClick for regular tools (not stamp/text/draw/polyline — handled by capture)
      const tool = useViewerStore.getState().activeToolId;
      if (tool !== 'stamp' && tool !== 'text' && tool !== 'draw' && tool !== 'polyline') {
        onClick(e);
      }

      // Start pan drag when pan tool is active
      if (tool === 'pan') {
        const el = elementRef.current;
        if (el && enabledRef.current) {
          try {
            const viewport = cornerstone.getViewport(el);
            if (viewport) {
              panDragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                startTx: viewport.translation?.x ?? 0,
                startTy: viewport.translation?.y ?? 0,
              };
            }
          } catch { /* ignore */ }
        }
      }
    }
  }, [onClick]);

  // ---- SUBMIT TEXT/STAMP ANNOTATION ----
  const handleSubmitAnnotation = useCallback(() => {
    if (!pendingInput || !inputText.trim() || !imageId) return;
    const newAnn: TextAnnotation = {
      id: `ann-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      text: inputText.trim(),
      xPercent: pendingInput.xPercent,
      yPercent: pendingInput.yPercent,
      color: inputColor,
      fontSize: inputFontSize,
      fontSizePercent: pxToFontSizePercent(inputFontSize),
      type: pendingInput.type,
    };
    addText(imageId, newAnn);

    // Apply to all selected viewports too
    placeTextOnAllSelectedViewports(imageId, newAnn);

    setPendingInput(null);
    setInputText('');
    useViewerStore.getState().setActiveTool('');
  }, [pendingInput, inputText, inputColor, inputFontSize, imageId, addText, pxToFontSizePercent]);

  const handleDeleteAnnotation = useCallback((annId: string) => {
    if (!imageId) return;
    removeText(imageId, annId);
  }, [imageId, removeText]);

  const handleEditAnnotation = useCallback((ann: TextAnnotation) => {
    setEditingAnn(ann);
    setEditColor(ann.color);
    setEditFontSize(ann.fontSize);
  }, []);

  const handleSaveEditAnnotation = useCallback(() => {
    if (!editingAnn || !imageId) return;
    const updated = { ...editingAnn, color: editColor, fontSize: editFontSize, fontSizePercent: pxToFontSizePercent(editFontSize) };
    updateText(imageId, updated);
    setEditingAnn(null);
  }, [editingAnn, editColor, editFontSize, imageId, updateText, pxToFontSizePercent]);

  const handleDeleteDrawPath = useCallback((pathId: string) => {
    if (!imageId) return;
    removePath(imageId, pathId);
  }, [imageId, removePath]);

  // ---- DRAG-AND-DROP ----
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const imageUrl = e.dataTransfer.getData('application/dicom-image-url');
    if (imageUrl && onImageDrop) onImageDrop(imageUrl);
  }, [onImageDrop]);

  // Cursor reflects the active tool
  const cursorClass = activeTool === 'pan' ? 'cursor-grab active:cursor-grabbing'
    : activeTool === 'zoom' ? 'cursor-zoom-in'
    : activeTool === 'wl' || activeTool === 'wwwc' ? 'cursor-col-resize'
    : 'cursor-crosshair';

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 bg-black overflow-hidden ${cursorClass}`}
      // CSS containment so child text annotations can size themselves with
      // `cqh` units (% of this container's HEIGHT). This is what makes
      // text labels scale proportionally between 1x1 zoom and small
      // multi-spot grid cells.
      style={{ containerType: 'size' } as React.CSSProperties}
      onMouseDownCapture={handleMouseDown}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Cornerstone render target */}
      <div
        ref={elementRef}
        data-viewport-index={viewportIndex}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Draw canvas overlay (for hold-to-draw) */}
      <canvas
        ref={drawCanvasRef}
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Empty state — black overlay covers stale cornerstone canvas */}
      {!imageId && (
        <div className="absolute inset-0 bg-black flex items-center justify-center text-gray-500 text-xs z-10 pointer-events-none">
          Empty
        </div>
      )}

      {/* Stored draw path annotations (SVG) */}
      {drawPaths.length > 0 && (
        <svg
          className="absolute inset-0 z-20 pointer-events-none"
          style={{ width: '100%', height: '100%' }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {drawPaths.map((path) => (
            <polyline
              key={path.id}
              points={path.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={path.color}
              strokeWidth="0.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      )}

      {/* Draw path delete buttons (shown on hover) */}
      {drawPaths.map((path) => {
        if (path.points.length === 0) return null;
        const midIdx = Math.floor(path.points.length / 2);
        const mid = path.points[midIdx];
        return (
          <button
            key={`del-${path.id}`}
            onClick={() => handleDeleteDrawPath(path.id)}
            className="absolute z-30 w-4 h-4 bg-red-600 text-white rounded-full text-[8px] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            style={{ left: `${mid.x}%`, top: `${mid.y}%`, transform: 'translate(-50%,-50%)' }}
            title="Delete path"
          >
            ×
          </button>
        );
      })}

      {/* Text/Stamp annotations overlay */}
      {annotations.map((ann) => {
        // Apply drag position override for smooth dragging
        const isDragging = dragPositionOverride?.id === ann.id;
        const displayX = isDragging ? dragPositionOverride.xPercent : ann.xPercent;
        const displayY = isDragging ? dragPositionOverride.yPercent : ann.yPercent;
        return (
        <div
          key={ann.id}
          data-annotation-overlay="true"
          className="absolute z-20 group select-none"
          style={{
            left: `${displayX}%`,
            top: `${displayY}%`,
            transform: 'translate(-50%, -50%)',
            cursor: draggingAnn?.id === ann.id ? 'grabbing' : 'grab',
          }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            setDraggingAnn({
              id: ann.id,
              startX: e.clientX,
              startY: e.clientY,
              startXPct: ann.xPercent,
              startYPct: ann.yPercent,
            });
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleEditAnnotation(ann);
          }}
        >
          <span
            className={`inline-block px-1.5 py-0.5 rounded font-bold whitespace-nowrap ${
              ann.type === 'stamp'
                ? 'border-2 border-current uppercase tracking-wider'
                : ''
            }`}
            style={{
              color: ann.color,
              fontSize: `max(${getEffectiveFontSizePercent(ann)}cqh, 8px)`,
              backgroundColor: 'rgba(0,0,0,0.6)',
              fontFamily: 'Arial, sans-serif',
              textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
            }}
          >
            {ann.text}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteAnnotation(ann.id); }}
            className="absolute -top-2 -right-2 w-4 h-4 bg-red-600 text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Delete annotation"
          >
            ×
          </button>
        </div>
        );
      })}

      {/* Edit annotation panel (double-click) — fixed to top-right corner, not on top of stamp */}
      {editingAnn && (
        <div
          className="absolute z-40 top-2 right-2"
          data-stamp-edit="true"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="bg-gray-900/95 border border-blue-500/70 rounded-xl p-2.5 shadow-2xl w-[200px] backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wide">Edit {editingAnn.type === 'stamp' ? 'Stamp' : 'Text'}</span>
              <button onClick={() => setEditingAnn(null)} className="w-4 h-4 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white text-[10px]">
                <X className="w-3 h-3" />
              </button>
            </div>
            {/* Color */}
            <div className="mb-2">
              <span className="text-[9px] text-gray-400 uppercase font-semibold block mb-1">Color</span>
              <div className="flex gap-1.5 flex-wrap">
                {['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffffff', '#ff8800', '#8800ff'].map(c => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    className={`w-5 h-5 rounded-full border-2 transition-transform ${editColor === c ? 'border-white scale-110 ring-2 ring-blue-500/50' : 'border-gray-600 hover:border-gray-400'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            {/* Size */}
            <div className="mb-2">
              <span className="text-[9px] text-gray-400 uppercase font-semibold block mb-1">Size</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setEditFontSize(Math.max(10, editFontSize - 2))}
                  onDoubleClick={(e) => e.stopPropagation()}
                  disabled={editFontSize <= 10}
                  className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 flex items-center justify-center">
                  <span
                    className="font-bold truncate max-w-[60px]"
                    style={{ color: editColor, fontSize: `${Math.min(editFontSize, 18)}px` }}
                  >
                    {editingAnn.text}
                  </span>
                </div>
                <span className="text-[10px] text-gray-300 font-bold w-8 text-center">{editFontSize}px</span>
                <button
                  onClick={() => setEditFontSize(Math.min(40, editFontSize + 2))}
                  onDoubleClick={(e) => e.stopPropagation()}
                  disabled={editFontSize >= 40}
                  className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { if (imageId) handleDeleteAnnotation(editingAnn.id); setEditingAnn(null); }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="w-7 h-7 flex items-center justify-center rounded bg-red-600/80 text-white hover:bg-red-500 transition-colors ml-1"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {/* Save */}
            <button
              onClick={handleSaveEditAnnotation}
              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-bold bg-blue-600/80 text-white rounded hover:bg-blue-500 transition-colors"
            >
              <Check className="w-3 h-3" /> Save
            </button>
          </div>
        </div>
      )}

      {/* Pending text/stamp input */}
      {pendingInput && (
        <div
          className="absolute z-30 top-2 right-2"
          data-pending-input="true"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="bg-gray-800 border border-blue-500 rounded-lg p-2 shadow-xl min-w-[180px] 2xl:min-w-[220px]">
            <div className="text-[9px] 2xl:text-[10px] text-blue-400 font-bold mb-1.5 uppercase">
              {pendingInput.type === 'stamp' ? 'Select Stamp to Place' : 'Add Text'}
            </div>
            {pendingInput.type === 'stamp' ? (
              <StampPickerPanel
                onSelect={(text, color, fontSize) => {
                  if (!imageId) return;
                  const newAnn: TextAnnotation = {
                    id: `ann-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    text, xPercent: pendingInput.xPercent, yPercent: pendingInput.yPercent,
                    color, fontSize, fontSizePercent: pxToFontSizePercent(fontSize), type: 'stamp',
                  };
                  addText(imageId, newAnn);
                  placeTextOnAllSelectedViewports(imageId, newAnn);
                  setPendingInput(null);
                  useViewerStore.getState().setActiveTool('');
                }}
                onCancel={() => setPendingInput(null)}
              />
            ) : (
              <div className="space-y-2">
                <div className="flex gap-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmitAnnotation();
                      if (e.key === 'Escape') setPendingInput(null);
                    }}
                    placeholder="Type text..."
                    className="flex-1 px-2 py-1 text-xs bg-gray-900 text-white border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-gray-400 uppercase">Size</span>
                  <input 
                    type="range" min="8" max="30" value={inputFontSize}
                    onChange={(e) => setInputFontSize(parseInt(e.target.value))}
                    className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[8px] text-white">{inputFontSize}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] text-gray-400 uppercase">Color</span>
                  <div className="flex gap-1.5">
                    {['#ffff00', '#00ff00', '#ffffff', '#ff0000', '#00ffff'].map(c => (
                      <button
                        key={c}
                        onClick={() => setInputColor(c)}
                        className={`w-4 h-4 rounded-full border ${inputColor === c ? 'border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={handleSubmitAnnotation}
                    className="flex-1 px-2 py-1 text-[10px] bg-blue-600 text-white rounded font-bold hover:bg-blue-500"
                  >
                    Add Text
                  </button>
                  <button
                    onClick={() => setPendingInput(null)}
                    className="px-2 py-1 text-[10px] bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cornerstone annotation edit overlay (double-click on shape) */}
      {editingCSAnnotation && elementRef.current && createPortal(
        <AnnotationEditOverlay
          element={elementRef.current}
          toolName={editingCSAnnotation.toolName}
          annotationIndex={editingCSAnnotation.annotationIndex}
          initialColor={editingCSAnnotation.color}
          initialLineWidth={editingCSAnnotation.lineWidth}
          position={editingCSAnnotation.position}
          onClose={() => setEditingCSAnnotation(null)}
        />,
        document.body
      )}

      {/* Right-click context menu (portal to body to avoid overflow clipping) */}
      {contextMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onMouseDown={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div
            className="fixed z-[61] bg-gray-900/95 border border-gray-600 rounded-lg shadow-2xl py-1 min-w-[160px] backdrop-blur-sm"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {[
              { label: 'Pan', tool: 'pan' },
              { label: 'Zoom', tool: 'zoom' },
              { label: 'Window/Level', tool: 'wl' },
              { label: 'Length', tool: 'length' },
              { label: 'Arrow', tool: 'arrow' },
              { label: 'Angle', tool: 'angle' },
              { label: 'Rectangle', tool: 'rectangleroi' },
              { label: 'Ellipse', tool: 'ellipticalroi' },
            ].map((item) => (
              <button
                key={item.tool}
                onClick={() => {
                  useViewerStore.getState().setActiveTool(item.tool);
                  activateTool(item.tool, elementRef.current);
                  setContextMenu(null);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-600/40 transition-colors ${
                  activeTool === item.tool ? 'text-blue-400 font-semibold' : 'text-gray-200'
                }`}
              >
                {item.label}
              </button>
            ))}
            <div className="border-t border-gray-700 my-1" />
            <button
              onClick={() => {
                const el = elementRef.current;
                if (el && enabledRef.current && imageId) {
                  resetViewport(el);
                }
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-blue-600/40 transition-colors"
            >
              Reset Viewport
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

/** StampPickerPanel — inline panel showing saved stamps for quick placement */
function StampPickerPanel({ onSelect, onCancel }: {
  onSelect: (text: string, color: string, fontSize: number) => void;
  onCancel: () => void;
}) {
  const { stamps, addStamp } = useStampStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newText, setNewText] = useState('');
  const [newColor, setNewColor] = useState('#ffff00');
  const [newFontSize, setNewFontSize] = useState(16);

  return (
    <div className="space-y-2">
      {/* Saved stamps list */}
      {stamps.length > 0 && (
        <div className="max-h-[180px] overflow-y-auto space-y-1">
          {stamps.map((stamp) => (
            <button
              key={stamp.id}
              onClick={() => onSelect(stamp.text, stamp.color, stamp.fontSize)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded border border-gray-600 hover:border-blue-400 hover:bg-gray-700/50 transition-colors text-left"
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stamp.color }} />
              <span className="text-[10px] font-bold text-white flex-1 truncate uppercase">{stamp.text}</span>
              <span className="text-[9px] text-gray-500">{stamp.fontSize}px</span>
            </button>
          ))}
        </div>
      )}

      {stamps.length === 0 && !showCreate && (
        <div className="text-[10px] text-gray-400 text-center py-2">No stamps yet. Create one below.</div>
      )}

      {/* Create new stamp inline */}
      {showCreate ? (
        <div className="border-t border-gray-600 pt-2 space-y-1.5">
          <div className="text-[9px] text-blue-400 font-bold uppercase">Create Stamp</div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. Hospital)"
            className="w-full px-2 py-1 text-[10px] bg-gray-900 text-white border border-gray-600 rounded focus:border-blue-500 focus:outline-none"
            autoFocus
          />
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Stamp text (e.g. APPROVED)"
            className="w-full px-2 py-1 text-[10px] bg-gray-900 text-white border border-gray-600 rounded focus:border-blue-500 focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-gray-400 uppercase">Size</span>
            <input type="range" min="10" max="40" value={newFontSize}
              onChange={(e) => setNewFontSize(parseInt(e.target.value))}
              className="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[9px] text-white w-8 text-right">{newFontSize}px</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-400 uppercase">Color</span>
            <div className="flex gap-1">
              {['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffffff'].map(c => (
                <button key={c} onClick={() => setNewColor(c)}
                  className={`w-4 h-4 rounded-full border-2 ${newColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {/* Preview */}
          <div className="p-1.5 bg-black/60 rounded border border-gray-700 text-center">
            <span className="inline-block px-1.5 py-0.5 rounded font-bold border-2 border-current uppercase tracking-wider"
              style={{ color: newColor, fontSize: `${Math.min(newFontSize, 18)}px`, textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
              {newText || 'PREVIEW'}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => {
                if (newName.trim() && newText.trim()) {
                  addStamp({ name: newName.trim(), text: newText.trim(), color: newColor, fontSize: newFontSize });
                  setNewName(''); setNewText(''); setShowCreate(false);
                }
              }}
              disabled={!newName.trim() || !newText.trim()}
              className="flex-1 px-2 py-1 text-[10px] bg-green-600 text-white rounded font-bold hover:bg-green-500 disabled:opacity-40"
            >
              Save Stamp
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-2 py-1 text-[10px] bg-gray-700 text-gray-300 rounded hover:bg-gray-600">
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1">
          <button
            onClick={() => setShowCreate(true)}
            className="flex-1 px-2 py-1.5 text-[10px] bg-blue-600/80 text-white rounded font-bold hover:bg-blue-500"
          >
            + New Stamp
          </button>
          <button
            onClick={onCancel}
            className="px-2 py-1.5 text-[10px] bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export const DicomViewport = memo(DicomViewportInner);

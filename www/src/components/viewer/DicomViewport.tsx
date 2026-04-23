/**
 * DicomViewport - Renders a single DICOM image using Cornerstone.js.
 * Custom mouse controls: scroll=zoom, right-drag=W/L, left-click=tool.
 * Supports text/stamp annotations (HTML overlays) and hold-to-draw (canvas overlay).
 * Uses capture-phase events so stamp/text always work even when cornerstone tools were used.
 */
import { useEffect, useRef, useCallback, memo, useState } from 'react';
import { cornerstone, cornerstoneTools } from '@/lib/cornerstoneSetup';
import { useViewerStore } from '@/stores/viewerStore';
import { useCustomAnnotationStore, type TextAnnotation, type DrawPath } from '@/stores/customAnnotationStore';


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

  // Right-click W/L drag state
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

  // Local sync of store annotations for rendering
  const { 
    getAnnotations, getDrawPaths, 
    addText, removeText, updateText, 
    addPath, removePath 
  } = useCustomAnnotationStore();

  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [drawPaths, setDrawPaths] = useState<DrawPath[]>([]);

  useEffect(() => {
    if (imageId) {
      setAnnotations([...getAnnotations(imageId)]);
      setDrawPaths([...getDrawPaths(imageId)]);
    } else {
      setAnnotations([]);
      setDrawPaths([]);
    }
    setPendingInput(null);
    isDrawingRef.current = false;
  }, [imageId, getAnnotations, getDrawPaths]);

  // Listen for annotation updates from other viewports (multi-select placement)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { imageId: string };
      if (detail?.imageId === imageId) {
        setAnnotations([...getAnnotations(detail.imageId)]);
        setDrawPaths([...getDrawPaths(detail.imageId)]);
      }
    };
    window.addEventListener('dicom-annotations-updated', handler);
    return () => window.removeEventListener('dicom-annotations-updated', handler);
  }, [imageId]);

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

  // Listen for clear-annotations event — directly wipe local state
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const targetEl = detail?.element;
      if (!targetEl || targetEl === elementRef.current) {
        setAnnotations([]);
        setDrawPaths([]);
        // Also cancel any in-progress drawing
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
      try { cornerstone.resize(el, true); } catch { /* ignore */ }
      // Also resize draw canvas
      const canvas = drawCanvasRef.current;
      if (canvas && el.parentElement) {
        canvas.width = el.parentElement.clientWidth;
        canvas.height = el.parentElement.clientHeight;
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
        rightDragRef.current = null;
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

      const list = getAnnotations(imageId);
      const ann = list.find(a => a.id === draggingAnn.id);
      if (ann) {
        // Just update local state for smooth drag
        setAnnotations(list.map(a => a.id === ann.id ? { ...a, xPercent: newXPct, yPercent: newYPct } : a));
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (draggingAnn && imageId) {
        const list = getAnnotations(imageId);
        const ann = list.find(a => a.id === draggingAnn.id);
        if (ann) {
          const rect = containerRef.current!.getBoundingClientRect();
          const dx = ((e.clientX - draggingAnn.startX) / rect.width) * 100;
          const dy = ((e.clientY - draggingAnn.startY) / rect.height) * 100;
          const finalXPct = Math.max(0, Math.min(100, draggingAnn.startXPct + dx));
          const finalYPct = Math.max(0, Math.min(100, draggingAnn.startYPct + dy));

          const updatedAnn = { ...ann, xPercent: finalXPct, yPercent: finalYPct };
          // data for history is the OLD state
          updateText(imageId, updatedAnn, ann);
          
          // Notify other viewports of movement
          placeTextOnAllSelectedViewports(imageId, updatedAnn);
        }
        setDraggingAnn(null);
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
  }, [draggingAnn, imageId]);

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

      const tool = useViewerStore.getState().activeToolId;

      // ---- STAMP ----
      if (tool === 'stamp' && imageId) {
        e.stopPropagation();
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
        setPendingInput({ xPercent, yPercent, type: 'stamp' });
        setInputText('VERIFIED');
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
        setDrawPaths([...getDrawPaths(imageId)]);

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
  function placeOnAllSelectedViewports(sourceImageId: string, drawPath: DrawPath) {
    const { selectedViewportIndices, selectedViewport } = useViewerStore.getState();
    if (selectedViewportIndices.length <= 1) return;

    selectedViewportIndices.forEach((vpIdx) => {
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
    const { selectedViewportIndices } = useViewerStore.getState();
    if (selectedViewportIndices.length <= 1) return;

    selectedViewportIndices.forEach((vpIdx) => {
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

  // ---- REACT MOUSE DOWN (right-click + viewport selection) ----
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      e.preventDefault();
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
      type: pendingInput.type,
    };
    addText(imageId, newAnn);
    setAnnotations([...getAnnotations(imageId)]);

    // Apply to all selected viewports too
    placeTextOnAllSelectedViewports(imageId, newAnn);

    setPendingInput(null);
    setInputText('');
  }, [pendingInput, inputText, inputColor, inputFontSize, imageId, addText, getAnnotations]);

  const handleDeleteAnnotation = useCallback((annId: string) => {
    if (!imageId) return;
    removeText(imageId, annId);
    setAnnotations([...getAnnotations(imageId)]);
  }, [imageId, removeText, getAnnotations]);

  const handleEditAnnotation = useCallback((ann: TextAnnotation) => {
    setEditingAnn(ann);
    setEditColor(ann.color);
    setEditFontSize(ann.fontSize);
  }, []);

  const handleSaveEditAnnotation = useCallback(() => {
    if (!editingAnn || !imageId) return;
    const updated = { ...editingAnn, color: editColor, fontSize: editFontSize };
    updateText(imageId, updated);
    setAnnotations([...getAnnotations(imageId).map(a => a.id === updated.id ? updated : a)]);
    setEditingAnn(null);
  }, [editingAnn, editColor, editFontSize, imageId, updateText, getAnnotations]);

  const handleDeleteDrawPath = useCallback((pathId: string) => {
    if (!imageId) return;
    removePath(imageId, pathId);
    setDrawPaths([...getDrawPaths(imageId)]);
  }, [imageId, removePath, getDrawPaths]);

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
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Cornerstone render target */}
      <div
        ref={elementRef}
        data-viewport-index={viewportIndex}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
        onContextMenu={(e) => e.preventDefault()}
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
      {annotations.map((ann) => (
        <div
          key={ann.id}
          className="absolute z-20 group select-none"
          style={{
            left: `${ann.xPercent}%`,
            top: `${ann.yPercent}%`,
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
              fontSize: `${ann.fontSize}px`,
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
      ))}

      {/* Edit annotation popup (double-click) */}
      {editingAnn && (
        <div
          className="absolute z-40"
          style={{
            left: `${editingAnn.xPercent}%`,
            top: `${editingAnn.yPercent}%`,
            transform: 'translate(-50%, -50%)',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="bg-gray-800 border border-blue-500 rounded-lg p-2 shadow-xl min-w-[180px]">
            <div className="text-[10px] text-blue-400 font-bold mb-1 uppercase">Edit {editingAnn.type === 'stamp' ? 'Stamp' : 'Text'}</div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-gray-400 uppercase">Size</span>
              <input 
                type="range" min="10" max="40" value={editFontSize}
                onChange={(e) => setEditFontSize(parseInt(e.target.value))}
                className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[8px] text-white">{editFontSize}px</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[8px] text-gray-400 uppercase">Color</span>
              <div className="flex gap-1.5">
                {['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffffff'].map(c => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    className={`w-4 h-4 rounded-full border ${editColor === c ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={handleSaveEditAnnotation}
                className="flex-1 px-2 py-1 text-[10px] bg-blue-600 text-white rounded font-bold hover:bg-blue-500"
              >
                Save
              </button>
              <button
                onClick={() => setEditingAnn(null)}
                className="px-2 py-1 text-[10px] bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending text/stamp input */}
      {pendingInput && (
        <div
          className="absolute z-30"
          data-pending-input="true"
          style={{
            left: `${pendingInput.xPercent}%`,
            top: `${pendingInput.yPercent}%`,
            transform: 'translate(-50%, -50%)',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="bg-gray-800 border border-blue-500 rounded-lg p-2 shadow-xl min-w-[180px]">
            <div className="text-[10px] text-blue-400 font-bold mb-1 uppercase">
              {pendingInput.type === 'stamp' ? 'Place Stamp' : 'Add Text'}
            </div>
            {pendingInput.type === 'stamp' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1">
                  {['VERIFIED', 'REVIEWED', 'APPROVED', 'REJECT', 'PENDING', 'URGENT'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setInputText(s)}
                      className={`px-1 py-1 text-[8px] font-bold border rounded uppercase transition-colors ${
                        inputText === s ? 'bg-red-600 border-red-400 text-white' : 'border-gray-600 text-gray-300 hover:border-red-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-gray-400 uppercase">Size</span>
                    <input 
                      type="range" min="10" max="40" value={inputFontSize}
                      onChange={(e) => setInputFontSize(parseInt(e.target.value))}
                      className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-[8px] text-white">{inputFontSize}px</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[8px] text-gray-400 uppercase">Color</span>
                    <div className="flex gap-1.5">
                      {['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffffff'].map(c => (
                        <button
                          key={c}
                          onClick={() => setInputColor(c)}
                          className={`w-4 h-4 rounded-full border ${inputColor === c ? 'border-white' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-1 mt-2">
                  <button
                    onClick={handleSubmitAnnotation}
                    className="flex-1 px-2 py-1 text-[10px] bg-red-600 text-white rounded font-bold hover:bg-red-500"
                  >
                    Place Stamp
                  </button>
                  <button
                    onClick={() => setPendingInput(null)}
                    className="px-2 py-1 text-[10px] bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                  >
                    ×
                  </button>
                </div>
              </div>
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
    </div>
  );
}

export const DicomViewport = memo(DicomViewportInner);

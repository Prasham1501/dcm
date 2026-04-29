import { create } from 'zustand';
import type { ViewerLayout, Orientation, PaperSize } from '@/types/viewer';
import { LAYOUT_CATEGORIES, mockImages } from '@/types/viewer';
import { studyService } from '@/services/studyService';
import { autoSelectLayoutForImageCount, getAutoOrientationForLayout } from '@/lib/layoutUtils';
import {
  localFileToImageId,
  orthancToImageId,
  filesToImageIds,
  scanLocalDirectory,
  prefetchImages,
} from '@/lib/dicomLoader';

const USE_API = import.meta.env.VITE_USE_API === 'true';

export interface DicomImage {
  id: string;
  instanceUID: string;
  seriesUID: string;
  studyUID: string;
  instanceNumber: number;
  seriesNumber: number;
  description: string;
  orthancId: string;
  imageUrl: string;
}

interface SeriesInfo {
  seriesUID: string;
  description: string;
  modality: string;
  instanceCount: number;
  orthancId: string;
}

interface ViewerState {
  // Layout
  currentLayout: ViewerLayout;
  orientation: Orientation;
  paperSize: PaperSize;
  showLayoutModal: boolean;

  // Page/navigation
  currentPage: number;
  totalPages: number;
  totalImages: number;
  imagesPerPage: number;

  // Viewport state
  selectedViewport: number;
  selectedViewportIndices: number[];
  activeToolId: string;

  // Double-click zoom (toggle 1x1)
  preDoubleClickLayout: ViewerLayout | null;
  preDoubleClickPage: number;
  doubleClickViewportImage: string | null;

  // UI
  showLogo: boolean;
  level: number;
  width: number;
  zoom: number;

  // Patient/study info
  patientName: string;
  patientId: string;
  studyDate: string;
  studyUID: string;
  orthancStudyId: string;

  // DICOM data
  series: SeriesInfo[];
  images: DicomImage[];
  viewportsCleared: boolean; // true = show empty viewports even though images[] is populated
  loadingStudy: boolean;
  studyError: string | null;
  loadProgress: number; // 0-100
  imageAspectRatio: number; // For aspect-safe grid rendering

  // Arrange mode
  isArrangeMode: boolean;
  arrangeSelectedImages: string[];
  arrangeClickOrder: number[];
  viewportImageOverrides: Record<number, string>;
  viewportIndexOverrides: Record<number, number>; // slot → original image index, for reliable number display

  // Cine playback
  isPlaying: boolean;
  cineFps: number;
  cineFrame: number; // current absolute image index being played
  showCine: boolean;

  // Actions
  setLayout: (layout: ViewerLayout) => void;
  setOrientation: (o: Orientation) => void;
  setPaperSize: (s: PaperSize) => void;
  setShowLayoutModal: (v: boolean) => void;
  setCurrentPage: (p: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setSelectedViewport: (v: number) => void;
  toggleViewportSelection: (v: number) => void;
  selectAllViewports: () => void;
  clearViewportSelection: () => void;
  setActiveTool: (toolId: string) => void;
  setShowLogo: (v: boolean) => void;
  setLevel: (v: number) => void;
  setWidth: (v: number) => void;
  setZoom: (v: number) => void;
  setPatientInfo: (name: string, date: string) => void;
  setImageAspectRatio: (ratio: number) => void;

  // Cine actions
  startCine: () => void;
  stopCine: () => void;
  setCineFps: (fps: number) => void;
  stepCine: (delta: number) => void;
  setShowCine: (v: boolean) => void;

  // Study loading
  loadStudy: (params: {
    patientId: string;
    patientName: string;
    studyDate: string;
    studyUID?: string;
    orthancStudyId?: string;
  }) => Promise<void>;

  // Viewport actions
  clearViewports: () => void;
  insertAllViewports: () => void;

  // Arrange actions
  toggleArrangeMode: () => void;
  toggleArrangeImageSelection: (imageUrl: string) => void;
  toggleArrangeViewport: (viewportIndex: number) => void;
  setViewportImageOverride: (viewportIndex: number, imageUrl: string) => void;
  setViewportIndexOverride: (viewportIndex: number, imageIndex: number) => void;
  clearViewportOverrides: () => void;
  deleteImageFromViewport: (viewportIndex: number) => void;

  // Double-click toggle
  toggleSingleViewport: (viewportIndex: number) => void;

  // Local file loading
  loadLocalFiles: (files: FileList | File[]) => void;
  loadLocalDirectory: (dirPath: string) => Promise<void>;

  // Load study from file paths (from folder sync)
  loadStudyFiles: (params: {
    patientName: string;
    patientId: string;
    studyDate: string;
    filePaths: string[];
  }) => void;
}

const defaultLayout = LAYOUT_CATEGORIES[3].layouts[0]; // 5-spot 2t3b
const autoSelectLayout = autoSelectLayoutForImageCount;

/**
 * Auto-select the best layout for a given image count.
 * Rules:
 *   Portrait: 1, 2, 4, 6, 8, 9, 15, 18 images
 *   Landscape: 12 images
 *   Others: smallest pure-grid layout with enough spots, portrait if rows >= cols
 */
function legacyAutoSelectLayout(imageCount: number): { layout: ViewerLayout; orientation: Orientation } {
  const portraitCounts = new Set([1, 2, 4, 6, 8, 9, 15, 18]);
  const landscapeCounts = new Set([12]);

  // Preferred layout id keyed by image count
  const PREFERRED: Record<number, string> = {
    1: '1x1',
    2: '2x1',      // 1col × 2row → portrait
    3: '1+2-left', // 3-spot portrait
    4: '2x2',      // 2x2 -> portrait sheet
    5: '2+2+1',    // 5-spot portrait
    6: '2x3',      // 2col × 3row → portrait
    7: '3+2+2',    // 7-spot portrait
    8: '2x4',      // 2col × 4row → portrait
    9: '3x3',      // 3x3 -> portrait sheet
    10: '3x4-11',  // 11-spot portrait (best fit)
    11: '3x4-11',  // 11-spot portrait
    12: '4x3',     // 4col × 3row → landscape
    15: '3x5',     // 3col × 5row → portrait
    18: '3x6',     // 3col × 6row → portrait
  };

  const findById = (id: string): ViewerLayout | null => {
    for (const cat of LAYOUT_CATEGORIES) {
      for (const l of cat.layouts) { if (l.id === id) return l; }
    }
    return null;
  };

  const preferredId = PREFERRED[imageCount];
  if (preferredId) {
    const layout = findById(preferredId);
    if (layout) {
      const orientation: Orientation = portraitCounts.has(imageCount) ? 'portrait'
        : landscapeCounts.has(imageCount) ? 'landscape'
        : layout.rows >= layout.cols ? 'portrait' : 'landscape';
      return { layout, orientation };
    }
  }

  // For unlisted counts: find smallest pure grid layout (no custom areas) that fits
  let best: ViewerLayout | null = null;
  for (const cat of LAYOUT_CATEGORIES) {
    for (const layout of cat.layouts) {
      if (layout.spots >= imageCount && !layout.areas) {
        if (!best || layout.spots < best.spots) best = layout;
      }
    }
  }
  if (best) {
    const orientation: Orientation = best.rows >= best.cols ? 'portrait' : 'landscape';
    return { layout: best, orientation };
  }

  return { layout: defaultLayout, orientation: 'portrait' };
}

/**
 * Open main viewer in a popup window (Electron) or navigate to /viewer (browser).
 * Stores launch data in localStorage for the new window to read.
 */
export async function openViewerPopup(params: {
  patientName: string;
  patientId: string;
  studyDate: string;
  filePaths: string[];
  layoutParam?: string;
}, navigate: (path: string) => void) {
  const imageCount = params.filePaths.length;
  const { orientation } = autoSelectLayout(imageCount);
  const isPortrait = orientation === 'portrait';

  // Store launch data for the popup window to read
  localStorage.setItem('viewer-launch', JSON.stringify({
    patientName: params.patientName,
    patientId: params.patientId,
    studyDate: params.studyDate,
    filePaths: params.filePaths,
    layoutParam: params.layoutParam,
    timestamp: Date.now(),
  }));

  // Try to open in Electron popup
  const { layout: autoLayout } = autoSelectLayout(imageCount);
  const api = (window as any).electronAPI;
  if (api?.openViewer) {
    try {
      await api.openViewer({ isPortrait, imageCount, cols: autoLayout.cols, rows: autoLayout.rows });
      return; // Success — don't navigate in the main window
    } catch (e) {
      console.warn('Failed to open viewer popup, falling back to navigation:', e);
    }
  }

  // Fallback: load study in current window and navigate
  useViewerStore.getState().loadStudyFiles(params);
  navigate(params.layoutParam ? `/viewer?layout=${params.layoutParam}` : '/viewer');
}

function recalcPages(totalImages: number, spotsPerPage: number) {
  return {
    totalImages,
    totalPages: Math.max(1, Math.ceil(totalImages / spotsPerPage)),
    imagesPerPage: spotsPerPage,
    currentPage: 1,
  };
}

// Cine interval handle (stored outside Zustand to avoid serialization issues)
let _cineInterval: ReturnType<typeof setInterval> | null = null;

function clearCineInterval() {
  if (_cineInterval !== null) {
    clearInterval(_cineInterval);
    _cineInterval = null;
  }
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  currentLayout: defaultLayout,
  orientation: 'portrait',
  paperSize: 'A4',
  showLayoutModal: false,

  currentPage: 1,
  totalPages: 1,
  totalImages: 0,
  imagesPerPage: defaultLayout.spots,

  selectedViewport: 0,
  selectedViewportIndices: [0],
  activeToolId: 'pan',

  preDoubleClickLayout: null,
  preDoubleClickPage: 1,
  doubleClickViewportImage: null,

  showLogo: true,
  level: 0,

  isPlaying: false,
  cineFps: 8,
  cineFrame: 0,
  showCine: false,
  width: 1,
  zoom: 1.0,

  patientName: '',
  patientId: '',
  studyDate: '',
  studyUID: '',
  orthancStudyId: '',

  series: [],
  images: [],
  viewportsCleared: false,
  loadingStudy: false,
  studyError: null,
  loadProgress: 0,
  imageAspectRatio: 4 / 3,

  isArrangeMode: false,
  arrangeSelectedImages: [],
  arrangeClickOrder: [],
  viewportImageOverrides: {},
  viewportIndexOverrides: {},

  setLayout: (layout) => {
    const { totalImages, currentLayout, preDoubleClickLayout, selectedViewport, selectedViewportIndices } = get();
    const clearSingleViewState = Boolean(preDoubleClickLayout) || (currentLayout.spots === 1 && layout.spots !== 1);
    // Drop any stale multi-selection or focused viewport that no longer exists
    // in the new layout — otherwise propagation paths (e.g. text/stamp placement
    // to all selected viewports) would write to images at out-of-range indices.
    const clampedSelected = Math.min(selectedViewport, layout.spots - 1);
    const clampedIndices = selectedViewportIndices.filter((i) => i < layout.spots);
    set({
      currentLayout: layout,
      orientation: getAutoOrientationForLayout(layout),
      ...recalcPages(totalImages || mockImages.length, layout.spots),
      selectedViewport: clampedSelected >= 0 ? clampedSelected : 0,
      selectedViewportIndices: clampedIndices.length > 0 ? clampedIndices : [0],
      ...(clearSingleViewState ? {
        preDoubleClickLayout: null,
        preDoubleClickPage: 1,
        doubleClickViewportImage: null,
        viewportImageOverrides: {},
        viewportIndexOverrides: {},
      } : {}),
    });
    // Resize the popup window to match the new layout's aspect ratio
    const api = (window as any).electronAPI;
    if (api?.resizeViewer) {
      api.resizeViewer({ cols: layout.cols, rows: layout.rows }).catch(() => {});
    }
  },
  setOrientation: (o) => {
    const { currentLayout, orientation, totalImages } = get();
    if (o === orientation) return;

    // For square layouts or 1x1, just toggle orientation state
    if (currentLayout.cols === currentLayout.rows) {
      set({ orientation: o });
      return;
    }

    // Determine if we need to swap: portrait wants rows>=cols, landscape wants cols>=rows
    const needsSwap = (o === 'portrait' && currentLayout.cols > currentLayout.rows)
                   || (o === 'landscape' && currentLayout.rows > currentLayout.cols);

    if (!needsSwap) {
      set({ orientation: o });
      return;
    }

    // Try to find a matching layout in LAYOUT_CATEGORIES with swapped dimensions
    const targetCols = currentLayout.rows;
    const targetRows = currentLayout.cols;
    let matchedLayout: ViewerLayout | null = null;

    for (const cat of LAYOUT_CATEGORIES) {
      for (const layout of cat.layouts) {
        if (layout.spots === currentLayout.spots &&
            layout.cols === targetCols && layout.rows === targetRows &&
            !layout.areas) {
          matchedLayout = layout;
          break;
        }
      }
      if (matchedLayout) break;
    }

    if (matchedLayout) {
      // Found an existing matching layout — use it
      set({
        orientation: o,
        currentLayout: matchedLayout,
        ...recalcPages(totalImages || mockImages.length, matchedLayout.spots),
      });
      // Resize the popup window to match the new layout's aspect ratio
      const api = (window as any).electronAPI;
      if (api?.resizeViewer) {
        api.resizeViewer({ cols: matchedLayout.cols, rows: matchedLayout.rows }).catch(() => {});
      }
    } else {
      // No matching layout found — create a swapped version on the fly
      const swapped: ViewerLayout = {
        ...currentLayout,
        cols: targetCols,
        rows: targetRows,
        id: `${targetCols}x${targetRows}`,
        areas: undefined,       // Clear areas — can't transpose grid-template-areas reliably
        gridTemplate: undefined, // Clear custom grid template too
      };
      set({
        orientation: o,
        currentLayout: swapped,
        ...recalcPages(totalImages || mockImages.length, swapped.spots),
      });
      // Resize the popup window to match the new layout's aspect ratio
      const api = (window as any).electronAPI;
      if (api?.resizeViewer) {
        api.resizeViewer({ cols: swapped.cols, rows: swapped.rows }).catch(() => {});
      }
    }
  },
  setPaperSize: (s) => set({ paperSize: s }),
  setShowLayoutModal: (v) => set({ showLayoutModal: v }),
  setCurrentPage: (p) => set({ currentPage: p }),
  nextPage: () => {
    const { currentPage, totalPages } = get();
    if (currentPage < totalPages) set({ currentPage: currentPage + 1 });
  },
  prevPage: () => {
    const { currentPage } = get();
    if (currentPage > 1) set({ currentPage: currentPage - 1 });
  },
  setSelectedViewport: (v) => {
    const { selectedViewportIndices, activeToolId } = get();
    // When select tool is active, clicking any viewport collapses multi-selection to just that viewport.
    if (activeToolId === 'select' && selectedViewportIndices.length > 1) {
      set({ selectedViewport: v, selectedViewportIndices: [v] });
      return;
    }
    // If viewport is already in multi-select, just update primary without clearing the selection.
    // This lets pan/tool interactions work on any selected viewport without losing multi-select.
    if (selectedViewportIndices.includes(v) && selectedViewportIndices.length > 1) {
      set({ selectedViewport: v });
    } else {
      set({ selectedViewport: v, selectedViewportIndices: [v] });
    }
  },
  toggleViewportSelection: (v) => {
    const { selectedViewportIndices } = get();
    const exists = selectedViewportIndices.includes(v);
    const next = exists
      ? selectedViewportIndices.filter((i) => i !== v)
      : [...selectedViewportIndices, v];
    set({ selectedViewportIndices: next.length > 0 ? next : [v], selectedViewport: v });
  },
  selectAllViewports: () => {
    const { currentLayout, selectedViewportIndices, selectedViewport } = get();
    const totalSpots = currentLayout.spots;
    // Toggle: if all viewports are already selected, collapse to just the active one
    if (selectedViewportIndices.length === totalSpots) {
      set({ selectedViewportIndices: [selectedViewport] });
    } else {
      const all = Array.from({ length: totalSpots }, (_, i) => i);
      set({ selectedViewportIndices: all });
    }
  },
  clearViewportSelection: () => set({ selectedViewportIndices: [get().selectedViewport] }),
  setActiveTool: (toolId) => set({ activeToolId: toolId }),
  setShowLogo: (v) => set({ showLogo: v }),
  setLevel: (v) => set({ level: v }),
  setWidth: (v) => set({ width: v }),
  setZoom: (v) => set({ zoom: v }),
  setPatientInfo: (name, date) => set({ patientName: name, studyDate: date }),
  setImageAspectRatio: (ratio) => set({ imageAspectRatio: ratio }),

  startCine: () => {
    clearCineInterval();
    const { cineFps, images, selectedViewport } = get();
    if (images.length === 0) return;
    // Remember which viewport cine started on
    const cineViewportIndex = selectedViewport;
    set({ isPlaying: true });

    _cineInterval = setInterval(() => {
      const state = get();
      if (!state.isPlaying || state.images.length === 0) { clearCineInterval(); return; }
      const nextFrame = (state.cineFrame + 1) % state.images.length;
      set({ cineFrame: nextFrame });

      // Drive only the selected viewport — do NOT change currentPage (keeps other viewports stable)
      const img = state.images[nextFrame];
      if (!img) return;
      const viewportEl = document.querySelector(`[data-viewport-index="${cineViewportIndex}"]`) as HTMLDivElement;
      if (viewportEl) {
        try {
          const cs = (window as any).__cornerstone;
          if (cs) {
            cs.loadAndCacheImage(img.imageUrl).then((image: any) => {
              try { cs.displayImage(viewportEl, image); } catch { /* ignore */ }
            }).catch(() => { /* ignore */ });
          }
        } catch { /* ignore */ }
      }
    }, Math.round(1000 / Math.max(1, cineFps)));
  },

  stopCine: () => {
    clearCineInterval();
    set({ isPlaying: false });
  },

  setCineFps: (fps: number) => {
    const wasPlaying = get().isPlaying;
    if (wasPlaying) {
      clearCineInterval();
      set({ cineFps: fps, isPlaying: false });
      // Restart with new fps
      setTimeout(() => useViewerStore.getState().startCine(), 10);
    } else {
      set({ cineFps: fps });
    }
  },

  stepCine: (delta: number) => {
    const { images, cineFrame, currentLayout } = get();
    if (images.length === 0) return;
    const nextFrame = (cineFrame + delta + images.length) % images.length;
    const nextPage = Math.floor(nextFrame / currentLayout.spots) + 1;
    set({ cineFrame: nextFrame, currentPage: nextPage });
  },

  setShowCine: (v) => set({ showCine: v }),

  clearViewports: () => {
    // Mark viewports as cleared — images stay in store so sidebar remains intact
    set({ viewportsCleared: true });
    // Reset cornerstone viewport display elements only (don't clear the images array)
    document.querySelectorAll('[data-viewport-index]').forEach((el) => {
      try {
        const cs = (window as any).__cornerstone;
        if (cs) cs.reset(el as HTMLElement);
      } catch { /* ignore */ }
    });
  },

  insertAllViewports: () => {
    const { images, currentLayout } = get();
    if (images.length === 0) return;

    // Un-clear the viewports and recalculate pages from the full images list
    const totalPages = Math.max(1, Math.ceil(images.length / currentLayout.spots));
    set({
      viewportsCleared: false,
      currentPage: 1,
      totalPages,
      totalImages: images.length,
      viewportImageOverrides: {},
      viewportIndexOverrides: {},
    });

    // Fire event for any components still listening
    document.dispatchEvent(new CustomEvent('dicom-insert-all'));
  },

  toggleArrangeMode: () => {
    const { isArrangeMode, arrangeSelectedImages, arrangeClickOrder, viewportImageOverrides, images, currentLayout, currentPage } = get();
    if (isArrangeMode) {
      if (arrangeClickOrder.length === 0) {
        set({ isArrangeMode: false, arrangeSelectedImages: [], arrangeClickOrder: [] });
        return;
      }

      const startIndex = (currentPage - 1) * currentLayout.spots;
      const selectedCount = arrangeClickOrder.length;

      // Collect images from the selected viewports in click order
      const selectedImages: string[] = [];
      for (let i = 0; i < arrangeClickOrder.length; i++) {
        const vpIdx = arrangeClickOrder[i];
        const overrideUrl = viewportImageOverrides[vpIdx];
        const defaultImg = images[startIndex + vpIdx];
        const imageUrl = overrideUrl || defaultImg?.imageUrl;
        if (imageUrl) selectedImages.push(imageUrl);
      }

      // If no images collected from viewports, use first N study images
      if (selectedImages.length === 0) {
        for (let i = 0; i < selectedCount && i < images.length; i++) {
          selectedImages.push(images[i].imageUrl);
        }
      }

      // Auto-select best layout for the selected count
      const { layout: bestLayout } = autoSelectLayout(selectedCount);

      // Build new overrides: place selected images sequentially in the new layout
      const newOverrides: Record<number, string> = {};
      const newIndexOverrides: Record<number, number> = {};
      for (let i = 0; i < selectedImages.length && i < bestLayout.spots; i++) {
        newOverrides[i] = selectedImages[i];
        const origIdx = images.findIndex((img) => img.imageUrl === selectedImages[i]);
        if (origIdx >= 0) newIndexOverrides[i] = origIdx;
      }

      set({
        isArrangeMode: false,
        arrangeSelectedImages: [],
        arrangeClickOrder: [],
        currentLayout: bestLayout,
        orientation: getAutoOrientationForLayout(bestLayout),
        ...recalcPages(get().totalImages, bestLayout.spots),
        viewportImageOverrides: newOverrides,
        viewportIndexOverrides: newIndexOverrides,
      });

      // Resize the popup window
      const api = (window as any).electronAPI;
      if (api?.resizeViewer) {
        api.resizeViewer({ cols: bestLayout.cols, rows: bestLayout.rows }).catch(() => {});
      }
    } else {
      set({
        isArrangeMode: true,
        arrangeSelectedImages: [],
        arrangeClickOrder: []
      });
    }
  },

  toggleArrangeImageSelection: (imageUrl) => {
    const { arrangeSelectedImages } = get();
    if (arrangeSelectedImages.includes(imageUrl)) {
      set({ arrangeSelectedImages: arrangeSelectedImages.filter(url => url !== imageUrl) });
    } else {
      set({ arrangeSelectedImages: [...arrangeSelectedImages, imageUrl] });
    }
  },

  toggleArrangeViewport: (viewportIndex) => {
    const { arrangeClickOrder, currentLayout } = get();
    if (arrangeClickOrder.includes(viewportIndex)) {
      set({ arrangeClickOrder: arrangeClickOrder.filter(idx => idx !== viewportIndex) });
    } else {
      // Allow selecting up to the total spots on layout, even if images aren't selected yet
      if (arrangeClickOrder.length < currentLayout.spots) {
        set({ arrangeClickOrder: [...arrangeClickOrder, viewportIndex] });
      }
    }
  },

  setViewportImageOverride: (viewportIndex, imageUrl) => {
    set((state) => ({
      viewportImageOverrides: {
        ...state.viewportImageOverrides,
        [viewportIndex]: imageUrl,
      }
    }));
  },

  setViewportIndexOverride: (viewportIndex, imageIndex) => {
    set((state) => ({
      viewportIndexOverrides: {
        ...state.viewportIndexOverrides,
        [viewportIndex]: imageIndex,
      }
    }));
  },

  clearViewportOverrides: () => set({ viewportImageOverrides: {}, viewportIndexOverrides: {} }),

  deleteImageFromViewport: (viewportIndex) => {
    const { currentPage, currentLayout, images, viewportImageOverrides, viewportIndexOverrides } = get();
    const globalIdx = (currentPage - 1) * currentLayout.spots + viewportIndex;
    
    const overrideUrl = viewportImageOverrides[viewportIndex];
    const defaultImg = images[globalIdx];
    const imageUrl = overrideUrl || defaultImg?.imageUrl || null;

    if (!imageUrl) return;

    // Remove the image from the array and shift subsequent images up
    const newImages = images.filter(img => img.imageUrl !== imageUrl);
    const newTotal = newImages.length;
    const spots = currentLayout.spots;
    const newTotalPages = Math.max(1, Math.ceil(newTotal / spots));
    const newCurrentPage = Math.min(currentPage, newTotalPages);

    set({
      images: newImages,
      totalImages: newTotal,
      totalPages: newTotalPages,
      currentPage: newCurrentPage,
      viewportImageOverrides: {},
      viewportIndexOverrides: {},
    });
  },

  // Double-click toggle: zoom into 1x1 showing clicked image, or restore previous layout
  toggleSingleViewport: (viewportIndex) => {
    const { preDoubleClickLayout, currentLayout, currentPage, images, viewportImageOverrides } = get();
    const allLayouts = LAYOUT_CATEGORIES.flatMap(c => c.layouts);
    const singleLayout = allLayouts.find(l => l.id === '1x1')!;

    if (preDoubleClickLayout) {
      // Restore previous layout
      const prevLayout = preDoubleClickLayout;
      const prevPage = get().preDoubleClickPage;
      set({
        currentLayout: prevLayout,
        orientation: getAutoOrientationForLayout(prevLayout),
        ...recalcPages(get().totalImages, prevLayout.spots),
        currentPage: prevPage,
        preDoubleClickLayout: null,
        preDoubleClickPage: 1,
        doubleClickViewportImage: null,
        viewportImageOverrides: {},
        viewportIndexOverrides: {},
        // Restore single-viewport focus so annotations don't propagate to other slots
        selectedViewport: viewportIndex < prevLayout.spots ? viewportIndex : 0,
        selectedViewportIndices: [viewportIndex < prevLayout.spots ? viewportIndex : 0],
      });
      const api = (window as any).electronAPI;
      if (api?.resizeViewer) {
        api.resizeViewer({ cols: prevLayout.cols, rows: prevLayout.rows }).catch(() => {});
      }
    } else {
      // Zoom into 1x1 showing the clicked viewport's image
      const startIndex = (currentPage - 1) * currentLayout.spots;
      const overrideUrl = viewportImageOverrides[viewportIndex];
      const defaultImg = images[startIndex + viewportIndex];
      const imageUrl = overrideUrl || defaultImg?.imageUrl || null;

      if (!imageUrl) return;

      const origIdx = images.findIndex((img) => img.imageUrl === imageUrl);
      set({
        preDoubleClickLayout: currentLayout,
        preDoubleClickPage: currentPage,
        doubleClickViewportImage: imageUrl,
        currentLayout: singleLayout,
        orientation: getAutoOrientationForLayout(singleLayout),
        ...recalcPages(get().totalImages, singleLayout.spots),
        currentPage: 1,
        viewportImageOverrides: { 0: imageUrl },
        viewportIndexOverrides: origIdx >= 0 ? { 0: origIdx } : {},
        // Collapse multi-selection: 1x1 has only one viewport, and stale indices
        // would otherwise make text/draw tools write into off-screen images.
        selectedViewport: 0,
        selectedViewportIndices: [0],
      });
      const api = (window as any).electronAPI;
      if (api?.resizeViewer) {
        api.resizeViewer({ cols: singleLayout.cols, rows: singleLayout.rows }).catch(() => {});
      }
    }
  },

  loadStudy: async (params) => {
    const layout = get().currentLayout;
    set({
      patientName: params.patientName,
      patientId: params.patientId,
      studyDate: params.studyDate,
      studyUID: params.studyUID || '',
      orthancStudyId: params.orthancStudyId || '',
      loadingStudy: true,
      studyError: null,
      loadProgress: 0,
      images: [],
      series: [],
      viewportsCleared: false,
    });

    if (!USE_API || !params.studyUID) {
      set({
        ...recalcPages(mockImages.length, layout.spots),
        loadingStudy: false,
      });
      return;
    }

    try {
      // Fetch series
      const seriesResponse = await studyService.getSeries(params.studyUID);
      const seriesList: SeriesInfo[] = seriesResponse.data.map((s: any) => ({
        seriesUID: s.series_uid,
        description: s.series_description || '',
        modality: s.modality || 'US',
        instanceCount: s.instance_count || 0,
        orthancId: s.orthanc_id || '',
      }));

      set({ series: seriesList, loadProgress: 20 });

      // Fetch instances for all series
      const allImages: DicomImage[] = [];
      for (const s of seriesList) {
        try {
          const instResponse = await studyService.getInstances(params.studyUID, s.seriesUID);
          for (const inst of instResponse.data) {
            const imgUrl = studyService.getInstanceImageUrl(
              params.studyUID, s.seriesUID, inst.instance_uid
            );
            allImages.push({
              id: inst.instance_uid || inst.orthanc_id,
              instanceUID: inst.instance_uid,
              seriesUID: s.seriesUID,
              studyUID: params.studyUID,
              instanceNumber: inst.instance_number || allImages.length + 1,
              seriesNumber: seriesList.indexOf(s) + 1,
              description: s.description,
              orthancId: inst.orthanc_id || '',
              imageUrl: `wadouri:${imgUrl}`,
            });
          }
        } catch {
          // skip failed series
        }
      }

      allImages.sort((a, b) => a.instanceNumber - b.instanceNumber);

      set({
        images: allImages,
        ...recalcPages(allImages.length, layout.spots),
        loadingStudy: false,
        loadProgress: 100,
      });

      // Prefetch first page
      const firstPageIds = allImages.slice(0, layout.spots).map(img => img.imageUrl);
      prefetchImages(firstPageIds, 4).catch(() => {});

      studyService.markRead(params.studyUID).catch(() => {});
    } catch (err: any) {
      set({
        ...recalcPages(mockImages.length, layout.spots),
        loadingStudy: false,
        studyError: err.message || 'Failed to load study',
      });
    }
  },

  loadLocalFiles: (files: FileList | File[]) => {
    const imageIds = filesToImageIds(files);

    if (imageIds.length === 0) return;

    const dicomImages: DicomImage[] = imageIds.map((imageId, i) => ({
      id: `local-${i}`,
      instanceUID: `local-${i}`,
      seriesUID: 'local',
      studyUID: 'local',
      instanceNumber: i + 1,
      seriesNumber: 1,
      description: 'Local File',
      orthancId: '',
      imageUrl: imageId,
    }));

    const { layout, orientation } = autoSelectLayout(dicomImages.length);
    set({
      images: dicomImages,
      currentLayout: layout,
      orientation,
      ...recalcPages(dicomImages.length, layout.spots),
      patientName: 'LOCAL FILES',
      studyDate: new Date().toLocaleDateString(),
      loadingStudy: false,
      studyError: null,
    });
  },

  loadLocalDirectory: async (dirPath: string) => {
    set({ loadingStudy: true, studyError: null, loadProgress: 0 });

    try {
      const { imageIds, files } = await scanLocalDirectory(dirPath, 200);

      const dicomImages: DicomImage[] = imageIds.map((imageId, i) => ({
        id: `dir-${i}`,
        instanceUID: `dir-${i}`,
        seriesUID: 'local-dir',
        studyUID: 'local-dir',
        instanceNumber: i + 1,
        seriesNumber: 1,
        description: files[i]?.filename || `Image ${i + 1}`,
        orthancId: '',
        imageUrl: imageId,
      }));

      const { layout, orientation } = autoSelectLayout(dicomImages.length);
      set({
        images: dicomImages,
        currentLayout: layout,
        orientation,
        ...recalcPages(dicomImages.length, layout.spots),
        patientName: dirPath.split('/').pop() || dirPath.split('\\').pop() || 'LOCAL',
        studyDate: new Date().toLocaleDateString(),
        loadingStudy: false,
        loadProgress: 100,
      });

      // Prefetch first page
      const firstPageIds = dicomImages.slice(0, layout.spots).map(img => img.imageUrl);
      prefetchImages(firstPageIds, 4, (loaded, total) => {
        set({ loadProgress: Math.round((loaded / total) * 100) });
      }).catch(() => {});
    } catch (err: any) {
      set({
        loadingStudy: false,
        studyError: err.message || 'Failed to scan directory',
      });
    }
  },

  loadStudyFiles: (params) => {
    const imageIds = params.filePaths.map((fp) => localFileToImageId(fp));

    const dicomImages: DicomImage[] = imageIds.map((imageId, i) => ({
      id: `study-${i}`,
      instanceUID: `study-${i}`,
      seriesUID: 'synced',
      studyUID: 'synced',
      instanceNumber: i + 1,
      seriesNumber: 1,
      description: params.filePaths[i].split('/').pop() || `Image ${i + 1}`,
      orthancId: '',
      imageUrl: imageId,
    }));

    const { layout, orientation } = autoSelectLayout(dicomImages.length);
    set({
      images: dicomImages,
      currentLayout: layout,
      orientation,
      viewportsCleared: false,
      ...recalcPages(dicomImages.length, layout.spots),
      patientName: params.patientName,
      patientId: params.patientId,
      studyDate: params.studyDate,
      loadingStudy: false,
      studyError: null,
      loadProgress: 100,
    });

    // Prefetch first page
    const firstPageIds = dicomImages.slice(0, layout.spots).map(img => img.imageUrl);
    prefetchImages(firstPageIds, 4).catch(() => {});
  },
}));

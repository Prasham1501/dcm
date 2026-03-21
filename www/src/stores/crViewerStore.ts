/**
 * crViewerStore — Independent state management for the CR format viewer.
 * Completely separate from viewerStore to avoid conflicts.
 */
import { create } from 'zustand';
import { localFileToImageId, prefetchImages } from '@/lib/dicomLoader';

export interface CRImage {
  id: string;
  imageUrl: string;
  description: string;
  instanceNumber: number;
  filePath: string;
}

export interface CRLayout {
  id: string;
  name: string;
  spots: number;
  cols: number;
  rows: number;
}

export const CR_LAYOUTS: CRLayout[] = [
  { id: 'cr-1',  name: '1 Spot',   spots: 1,  cols: 1, rows: 1 },
  { id: 'cr-2',  name: '2 Spots',  spots: 2,  cols: 1, rows: 2 },
  { id: 'cr-4',  name: '4 Spots',  spots: 4,  cols: 2, rows: 2 },
  { id: 'cr-6',  name: '6 Spots',  spots: 6,  cols: 2, rows: 3 },
  { id: 'cr-8',  name: '8 Spots',  spots: 8,  cols: 2, rows: 4 },
  { id: 'cr-9',  name: '9 Spots',  spots: 9,  cols: 3, rows: 3 },
  { id: 'cr-12', name: '12 Spots', spots: 12, cols: 4, rows: 3 },
  { id: 'cr-15', name: '15 Spots', spots: 15, cols: 3, rows: 5 },
  { id: 'cr-18', name: '18 Spots', spots: 18, cols: 3, rows: 6 },
];

export interface CRStamp {
  id: string;
  name: string;
  text: string;
  color: string;
  fontSize: number;
  createdAt: number;
}

interface StampPlacement {
  id: string;
  stampId: string;
  text: string;
  color: string;
  fontSize: number;
  viewportIndex: number;
  xPercent: number;
  yPercent: number;
}

interface CRViewerState {
  // Patient info
  patientName: string;
  patientId: string;
  studyDate: string;

  // Images
  images: CRImage[];
  totalImages: number;

  // Layout
  currentLayout: CRLayout;
  currentPage: number;
  totalPages: number;

  // Selection
  selectedViewport: number;
  selectedCount: number;

  // Viewport overrides (for arrange mode)
  viewportImageOverrides: Record<number, string>;

  // Arrange mode
  isArrangeMode: boolean;
  arrangeClickOrder: number[];

  // Stamps
  stamps: CRStamp[];
  stampPlacements: StampPlacement[];
  activeStampId: string | null;
  isStampMode: boolean;

  // Logo
  showLogo: boolean;

  // Scroll mode
  isScrollMode: boolean;

  // Loading
  isLoading: boolean;

  // Actions
  loadStudy: (params: {
    patientName: string;
    patientId: string;
    studyDate: string;
    filePaths: string[];
  }) => void;
  setLayout: (layout: CRLayout) => void;
  setCurrentPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setSelectedViewport: (index: number) => void;

  // Arrange
  toggleArrangeMode: () => void;
  toggleArrangeViewport: (index: number) => void;
  applyArrange: () => void;
  setViewportImageOverride: (index: number, imageUrl: string) => void;

  // Reset
  resetAll: () => void;
  resetOne: (viewportIndex: number) => void;

  // Resequence
  resequence: () => void;

  // Apply W/L to all
  applyToAll: boolean;
  setApplyToAll: (v: boolean) => void;

  // Logo
  setShowLogo: (v: boolean) => void;

  // Scroll
  setScrollMode: (v: boolean) => void;
  scrollNext: () => void;
  scrollPrev: () => void;

  // Stamps
  addStamp: (stamp: Omit<CRStamp, 'id' | 'createdAt'>) => void;
  removeStamp: (id: string) => void;
  setActiveStamp: (id: string | null) => void;
  setStampMode: (v: boolean) => void;
  placeStamp: (viewportIndex: number, xPercent: number, yPercent: number) => void;
  removeStampPlacement: (id: string) => void;
  updateStampPlacement: (id: string, xPercent: number, yPercent: number) => void;
  undoStampPlacement: () => void;
  clearStampPlacements: (viewportIndex?: number) => void;
}

function recalcPages(totalImages: number, spotsPerPage: number) {
  return {
    totalImages,
    totalPages: Math.max(1, Math.ceil(totalImages / spotsPerPage)),
    currentPage: 1,
  };
}

/**
 * Determine if a layout is portrait orientation (cols < rows).
 * Portrait: 2(1×2), 6(2×3), 8(2×4), 15(3×5), 18(3×6)
 * Landscape/Square: 1(1×1), 4(2×2), 9(3×3), 12(4×3)
 */
export function isPortraitLayout(layout: CRLayout): boolean {
  return layout.cols < layout.rows;
}

/**
 * Open CR viewer in a popup window (Electron) or navigate to /cr-viewer (browser).
 * Stores launch data in localStorage for the new window to read.
 */
export async function openCRViewerPopup(params: {
  patientName: string;
  patientId: string;
  studyDate: string;
  filePaths: string[];
}, navigate: (path: string) => void) {
  const imageCount = params.filePaths.length;
  const layout = autoSelectLayout(imageCount);
  const portrait = isPortraitLayout(layout);

  // Store launch data for the popup window to read
  localStorage.setItem('cr-viewer-launch', JSON.stringify({
    ...params,
    timestamp: Date.now(),
  }));

  // Try to open in Electron popup
  const api = (window as any).electronAPI;
  if (api?.openCRViewer) {
    try {
      await api.openCRViewer({ isPortrait: portrait, imageCount, cols: layout.cols, rows: layout.rows });
      return; // Success — don't navigate in the main window
    } catch (e) {
      console.warn('Failed to open CR viewer popup, falling back to navigation:', e);
    }
  }

  // Fallback: load study in current window and navigate
  useCRViewerStore.getState().loadStudy(params);
  navigate('/cr-viewer');
}

function autoSelectLayout(imageCount: number): CRLayout {
  if (imageCount <= 1)  return CR_LAYOUTS[0]; // 1 spot
  if (imageCount <= 2)  return CR_LAYOUTS[1]; // 2 spots
  if (imageCount <= 4)  return CR_LAYOUTS[2]; // 4 spots
  if (imageCount <= 6)  return CR_LAYOUTS[3]; // 6 spots
  if (imageCount <= 8)  return CR_LAYOUTS[4]; // 8 spots
  if (imageCount <= 9)  return CR_LAYOUTS[5]; // 9 spots
  if (imageCount <= 12) return CR_LAYOUTS[6]; // 12 spots
  if (imageCount <= 15) return CR_LAYOUTS[7]; // 15 spots
  return CR_LAYOUTS[8]; // 18 spots
}

// Load saved stamps from localStorage
function loadSavedStamps(): CRStamp[] {
  try {
    const saved = localStorage.getItem('cr-viewer-stamps');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveStamps(stamps: CRStamp[]) {
  try {
    localStorage.setItem('cr-viewer-stamps', JSON.stringify(stamps));
  } catch { /* ignore */ }
}

export const useCRViewerStore = create<CRViewerState>((set, get) => ({
  patientName: '',
  patientId: '',
  studyDate: '',
  images: [],
  totalImages: 0,
  currentLayout: CR_LAYOUTS[2], // default 4 spots
  currentPage: 1,
  totalPages: 1,
  selectedViewport: 0,
  selectedCount: 0,
  viewportImageOverrides: {},
  isArrangeMode: false,
  arrangeClickOrder: [],
  stamps: loadSavedStamps(),
  stampPlacements: [],
  activeStampId: null,
  isStampMode: false,
  showLogo: true,
  isScrollMode: false,
  isLoading: false,
  applyToAll: false,

  loadStudy: (params) => {
    set({ isLoading: true });

    const imageIds = params.filePaths.map((fp) => localFileToImageId(fp));
    const crImages: CRImage[] = imageIds.map((imageId, i) => ({
      id: `cr-${i}`,
      imageUrl: imageId,
      description: params.filePaths[i].split('/').pop() || `Image ${i + 1}`,
      instanceNumber: i + 1,
      filePath: params.filePaths[i],
    }));

    const layout = autoSelectLayout(crImages.length);

    set({
      images: crImages,
      currentLayout: layout,
      ...recalcPages(crImages.length, layout.spots),
      patientName: params.patientName,
      patientId: params.patientId,
      studyDate: params.studyDate,
      isLoading: false,
      selectedViewport: 0,
      selectedCount: 0,
      viewportImageOverrides: {},
      isArrangeMode: false,
      arrangeClickOrder: [],
      stampPlacements: [],
    });

    // Prefetch first page
    const firstPageIds = crImages.slice(0, layout.spots).map(img => img.imageUrl);
    prefetchImages(firstPageIds, 4).catch(() => {});
  },

  setLayout: (layout) => {
    const { totalImages } = get();
    set({
      currentLayout: layout,
      ...recalcPages(totalImages, layout.spots),
      viewportImageOverrides: {},
    });
    // Resize the popup window to match the new layout's aspect ratio
    const api = (window as any).electronAPI;
    if (api?.resizeCRViewer) {
      api.resizeCRViewer({ cols: layout.cols, rows: layout.rows }).catch(() => {});
    }
  },

  setCurrentPage: (page) => set({ currentPage: page }),

  nextPage: () => {
    const { currentPage, totalPages } = get();
    if (currentPage < totalPages) set({ currentPage: currentPage + 1 });
  },

  prevPage: () => {
    const { currentPage } = get();
    if (currentPage > 1) set({ currentPage: currentPage - 1 });
  },

  setSelectedViewport: (index) => set({ selectedViewport: index }),

  // Arrange
  toggleArrangeMode: () => {
    const { isArrangeMode } = get();
    if (isArrangeMode) {
      // Leaving arrange mode - apply arrangement
      get().applyArrange();
    } else {
      set({ isArrangeMode: true, arrangeClickOrder: [] });
    }
  },

  toggleArrangeViewport: (index) => {
    const { arrangeClickOrder, currentLayout } = get();
    if (arrangeClickOrder.includes(index)) {
      set({ arrangeClickOrder: arrangeClickOrder.filter(i => i !== index) });
    } else if (arrangeClickOrder.length < currentLayout.spots) {
      set({ arrangeClickOrder: [...arrangeClickOrder, index] });
    }
  },

  applyArrange: () => {
    const { arrangeClickOrder, images, currentPage, currentLayout, viewportImageOverrides } = get();
    if (arrangeClickOrder.length === 0) {
      set({ isArrangeMode: false, arrangeClickOrder: [] });
      return;
    }

    const startIndex = (currentPage - 1) * currentLayout.spots;
    const newOverrides = { ...viewportImageOverrides };

    for (let i = 0; i < arrangeClickOrder.length; i++) {
      const imgIndex = startIndex + i;
      if (imgIndex < images.length) {
        newOverrides[arrangeClickOrder[i]] = images[imgIndex].imageUrl;
      }
    }

    set({
      isArrangeMode: false,
      arrangeClickOrder: [],
      viewportImageOverrides: newOverrides,
    });
  },

  setViewportImageOverride: (index, imageUrl) => {
    set((state) => ({
      viewportImageOverrides: { ...state.viewportImageOverrides, [index]: imageUrl },
    }));
  },

  // Reset
  resetAll: () => {
    set({
      viewportImageOverrides: {},
      stampPlacements: [],
      selectedViewport: 0,
    });
  },

  resetOne: (viewportIndex) => {
    set((state) => {
      const overrides = { ...state.viewportImageOverrides };
      delete overrides[viewportIndex];
      return {
        viewportImageOverrides: overrides,
        stampPlacements: state.stampPlacements.filter(s => s.viewportIndex !== viewportIndex),
      };
    });
  },

  // Resequence: reset overrides to default sequential order
  resequence: () => {
    set({ viewportImageOverrides: {} });
  },

  // Apply to all
  setApplyToAll: (v) => set({ applyToAll: v }),

  // Logo
  setShowLogo: (v) => set({ showLogo: v }),

  // Scroll
  setScrollMode: (v) => set({ isScrollMode: v }),

  scrollNext: () => {
    const { currentPage, totalPages } = get();
    if (currentPage < totalPages) set({ currentPage: currentPage + 1 });
  },

  scrollPrev: () => {
    const { currentPage } = get();
    if (currentPage > 1) set({ currentPage: currentPage - 1 });
  },

  // Stamps
  addStamp: (stamp) => {
    const id = `stamp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newStamp: CRStamp = { ...stamp, id, createdAt: Date.now() };
    const stamps = [...get().stamps, newStamp];
    set({ stamps });
    saveStamps(stamps);
  },

  removeStamp: (id) => {
    const stamps = get().stamps.filter(s => s.id !== id);
    set({ stamps });
    saveStamps(stamps);
  },

  setActiveStamp: (id) => set({ activeStampId: id }),

  setStampMode: (v) => set({ isStampMode: v, activeStampId: v ? get().activeStampId : null }),

  placeStamp: (viewportIndex, xPercent, yPercent) => {
    const { activeStampId, stamps } = get();
    const stamp = stamps.find(s => s.id === activeStampId);
    if (!stamp) return;

    const placement: StampPlacement = {
      id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      stampId: stamp.id,
      text: stamp.text,
      color: stamp.color,
      fontSize: stamp.fontSize,
      viewportIndex,
      xPercent,
      yPercent,
    };

    set((state) => ({
      stampPlacements: [...state.stampPlacements, placement],
    }));
  },

  removeStampPlacement: (id) => {
    set((state) => ({
      stampPlacements: state.stampPlacements.filter(s => s.id !== id),
    }));
  },

  updateStampPlacement: (id, xPercent, yPercent) => {
    set((state) => ({
      stampPlacements: state.stampPlacements.map(s =>
        s.id === id ? { ...s, xPercent, yPercent } : s
      ),
    }));
  },

  undoStampPlacement: () => {
    set((state) => ({
      stampPlacements: state.stampPlacements.slice(0, -1),
    }));
  },

  clearStampPlacements: (viewportIndex) => {
    if (viewportIndex !== undefined) {
      set((state) => ({
        stampPlacements: state.stampPlacements.filter(s => s.viewportIndex !== viewportIndex),
      }));
    } else {
      set({ stampPlacements: [] });
    }
  },
}));

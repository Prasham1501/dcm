/**
 * dualViewerStore — Independent state management for the Dual comparison viewer.
 * Two independent panel states (left/right), shared stamps, active panel tracking.
 * Completely separate from viewerStore and crViewerStore.
 */
import { create } from 'zustand';
import { localFileToImageId, prefetchImages } from '@/lib/dicomLoader';
import { useUndoStore } from '@/stores/undoStore';
import { useHospitalConfigStore } from '@/stores/hospitalConfigStore';

// ── Types ──

export type PanelId = 'left' | 'right';

export interface DualImage {
  id: string;
  imageUrl: string;
  description: string;
  instanceNumber: number;
  filePath: string;
}

export interface DualLayout {
  id: string;
  name: string;
  spots: number;
  cols: number;
  rows: number;
}

export const DUAL_LAYOUTS: DualLayout[] = [
  { id: 'dual-1',  name: '1 Spot',   spots: 1,  cols: 1, rows: 1 },
  { id: 'dual-2',  name: '2 Spots',  spots: 2,  cols: 1, rows: 2 },
  { id: 'dual-4',  name: '4 Spots',  spots: 4,  cols: 2, rows: 2 },
  { id: 'dual-6',  name: '6 Spots',  spots: 6,  cols: 2, rows: 3 },
  { id: 'dual-8',  name: '8 Spots',  spots: 8,  cols: 2, rows: 4 },
  { id: 'dual-9',  name: '9 Spots',  spots: 9,  cols: 3, rows: 3 },
  { id: 'dual-12', name: '12 Spots', spots: 12, cols: 4, rows: 3 },
  { id: 'dual-15', name: '15 Spots', spots: 15, cols: 3, rows: 5 },
  { id: 'dual-18', name: '18 Spots', spots: 18, cols: 3, rows: 6 },
];

export interface DualStamp {
  id: string;
  name: string;
  text: string;
  color: string;
  fontSize: number;
  createdAt: number;
}

export interface DualStampPlacement {
  id: string;
  stampId: string;
  panelId: PanelId;
  text: string;
  color: string;
  fontSize: number;
  fontSizePercent?: number;
  imageId: string;
  xPercent: number;
  yPercent: number;
  type?: 'stamp' | 'text';
}

// ── Panel Sub-State ──

interface PanelState {
  patientName: string;
  patientId: string;
  studyDate: string;
  images: DualImage[];
  originalImages: DualImage[];
  totalImages: number;
  currentLayout: DualLayout;
  currentPage: number;
  totalPages: number;
  selectedViewport: number;
  selectedViewportIndices: number[];
  isArrangeMode: boolean;
  arrangeClickOrder: number[];
  applyToAll: boolean;
  preDoubleClickLayout: DualLayout | null;
  preDoubleClickPage: number;
  doubleClickViewportImage: string | null;
}

function createDefaultPanelState(): PanelState {
  return {
    patientName: '',
    patientId: '',
    studyDate: '',
    images: [],
    originalImages: [],
    totalImages: 0,
    currentLayout: DUAL_LAYOUTS[2], // 4 spots
    currentPage: 1,
    totalPages: 1,
    selectedViewport: 0,
    selectedViewportIndices: [0],
    isArrangeMode: false,
    arrangeClickOrder: [],
    applyToAll: false,
    preDoubleClickLayout: null,
    preDoubleClickPage: 1,
    doubleClickViewportImage: null,
  };
}

// ── Store Interface ──

interface DualViewerState {
  panels: Record<PanelId, PanelState>;
  activePanel: PanelId;

  // Stamps (shared)
  stamps: DualStamp[];
  stampPlacements: DualStampPlacement[];
  isStampMode: boolean;
  activeStampId: string | null;

  // Text
  isTextMode: boolean;

  // Footer (independent from hospitalConfigStore)
  dualFooterEnabled: boolean;
  dualFooterLayout: { left: string; center: string; right: string };
  dualFooterFontSize: number;
  dualFooterFontColor: string;
  dualFooterBgColor: string;
  dualFooterBorderTopColor: string;
  dualFooterCustomLeft: string;
  dualFooterCustomCenter: string;
  dualFooterCustomRight: string;

  // UI
  isLoading: boolean;
  showLogo: boolean;
  syncMove: boolean;

  // Panel actions
  loadPanelStudy: (panelId: PanelId, params: {
    patientName: string; patientId: string; studyDate: string; filePaths: string[];
  }) => void;
  setPanelLayout: (panelId: PanelId, layout: DualLayout) => void;
  panelNextPage: (panelId: PanelId) => void;
  panelPrevPage: (panelId: PanelId) => void;
  setPanelPage: (panelId: PanelId, page: number) => void;
  setPanelSelectedViewport: (panelId: PanelId, index: number) => void;
  togglePanelViewportSelection: (panelId: PanelId, index: number) => void;
  selectAllPanelViewports: (panelId: PanelId) => void;
  panelSwapImages: (panelId: PanelId, idxA: number, idxB: number) => void;
  togglePanelArrangeMode: (panelId: PanelId) => void;
  togglePanelArrangeViewport: (panelId: PanelId, index: number) => void;
  applyPanelArrange: (panelId: PanelId) => void;
  resetPanelAll: (panelId: PanelId) => void;
  clearPanelViewport: (panelId: PanelId) => void;
  setPanelApplyToAll: (panelId: PanelId, v: boolean) => void;
  togglePanelSingleViewport: (panelId: PanelId, viewportIndex: number) => void;
  setPanelViewportImage: (panelId: PanelId, imageUrl: string, viewportIndex: number) => void;
  deleteImageFromViewport: (panelId: PanelId, viewportIndex: number) => void;

  // Active panel
  setActivePanel: (panelId: PanelId) => void;
  setSyncMove: (v: boolean) => void;

  // Active-panel convenience wrappers
  activeNextPage: () => void;
  activePrevPage: () => void;
  activeSelectAll: () => void;
  activeResetAll: () => void;
  activeClear: () => void;

  // Arrange both panels
  toggleBothArrangeMode: () => void;

  // Stamps
  addStamp: (stamp: Omit<DualStamp, 'id' | 'createdAt'>) => void;
  removeStamp: (id: string) => void;
  setActiveStamp: (id: string | null) => void;
  setStampMode: (v: boolean) => void;
  placeStamp: (panelId: PanelId, imageId: string, xPercent: number, yPercent: number, containerHeight?: number) => void;
  removeStampPlacement: (id: string) => void;
  updateStampPlacement: (id: string, xPercent: number, yPercent: number) => void;
  undoStampPlacement: () => void;
  clearStampPlacements: (panelId?: PanelId, viewportIndex?: number) => void;

  // Text
  setTextMode: (v: boolean) => void;
  placeTextDirect: (panelId: PanelId, imageId: string, xPercent: number, yPercent: number, text: string, color: string, fontSize: number, containerHeight?: number) => void;

  // Logo
  setShowLogo: (v: boolean) => void;

  // Footer actions
  updateDualFooterField: (key: string, value: any) => void;
  updateDualFooterLayout: (slot: 'left' | 'center' | 'right', value: string) => void;
}

// ── Helpers ──

function recalcPages(totalImages: number, spotsPerPage: number) {
  return {
    totalImages,
    totalPages: Math.max(1, Math.ceil(totalImages / spotsPerPage)),
    currentPage: 1,
  };
}

function autoSelectLayout(imageCount: number): DualLayout {
  if (imageCount <= 1)  return DUAL_LAYOUTS[0];
  if (imageCount <= 2)  return DUAL_LAYOUTS[1];
  if (imageCount <= 4)  return DUAL_LAYOUTS[2];
  if (imageCount <= 6)  return DUAL_LAYOUTS[3];
  if (imageCount <= 8)  return DUAL_LAYOUTS[4];
  if (imageCount <= 9)  return DUAL_LAYOUTS[5];
  if (imageCount <= 12) return DUAL_LAYOUTS[6];
  if (imageCount <= 15) return DUAL_LAYOUTS[7];
  return DUAL_LAYOUTS[8];
}

function loadSavedStamps(): DualStamp[] {
  try {
    const saved = localStorage.getItem('dual-viewer-stamps');
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveStamps(stamps: DualStamp[]) {
  try { localStorage.setItem('dual-viewer-stamps', JSON.stringify(stamps)); } catch { /* ignore */ }
}

// Helper to update a single panel within the store
function updatePanel(
  state: DualViewerState,
  panelId: PanelId,
  update: Partial<PanelState>,
): Partial<DualViewerState> {
  return {
    panels: {
      ...state.panels,
      [panelId]: { ...state.panels[panelId], ...update },
    },
  };
}

// ── Store ──

function getInitialFooterFromConfig() {
  const hc = useHospitalConfigStore.getState();
  return {
    dualFooterEnabled: hc.enableFooter ?? false,
    dualFooterLayout: { left: hc.footerLayout?.left || 'custom', center: hc.footerLayout?.center || 'none', right: hc.footerLayout?.right || 'custom' },
    dualFooterFontSize: hc.footerFontSize || 8,
    dualFooterFontColor: hc.footerFontColor || '#999999',
    dualFooterBgColor: hc.footerBgColor || '#ffffff',
    dualFooterBorderTopColor: hc.footerBorderTopColor || '#cccccc',
    dualFooterCustomLeft: hc.customFooterLeft || '',
    dualFooterCustomCenter: hc.customFooterCenter || 'Printed by: ADMIN',
    dualFooterCustomRight: hc.customFooterRight || '',
  };
}

export const useDualViewerStore = create<DualViewerState>((set, get) => {
  const initFooter = getInitialFooterFromConfig();
  return ({
  panels: { left: createDefaultPanelState(), right: createDefaultPanelState() },
  activePanel: 'left',
  stamps: loadSavedStamps(),
  stampPlacements: [],
  isStampMode: false,
  activeStampId: null,
  isTextMode: false,
  ...initFooter,

  isLoading: false,
  showLogo: true,
  syncMove: true,

  // ── Panel Actions ──

  loadPanelStudy: (panelId, params) => {
    useUndoStore.getState().clear('dualViewer');
    const imageIds = params.filePaths.map(fp => localFileToImageId(fp));
    const dualImages: DualImage[] = imageIds.map((imageId, i) => ({
      id: `dual-${panelId}-${i}`,
      imageUrl: imageId,
      description: params.filePaths[i].split('/').pop() || `Image ${i + 1}`,
      instanceNumber: i + 1,
      filePath: params.filePaths[i],
    }));

    const layout = autoSelectLayout(dualImages.length);

    set((state) => updatePanel(state, panelId, {
      images: dualImages,
      originalImages: dualImages,
      currentLayout: layout,
      ...recalcPages(dualImages.length, layout.spots),
      patientName: params.patientName,
      patientId: params.patientId,
      studyDate: params.studyDate,
      selectedViewport: 0,
      selectedViewportIndices: [0],
      isArrangeMode: false,
      arrangeClickOrder: [],
      preDoubleClickLayout: null,
      preDoubleClickPage: 1,
      doubleClickViewportImage: null,
    }));

    // Prefetch first page
    const firstPageIds = dualImages.slice(0, layout.spots).map(img => img.imageUrl);
    prefetchImages(firstPageIds, 4).catch(() => {});
  },

  setPanelLayout: (panelId, layout) => {
    const panel = get().panels[panelId];
    const prevLayout = panel.currentLayout;
    const prevPage = panel.currentPage;
    const prevPre = panel.preDoubleClickLayout;
    useUndoStore.getState().push('dualViewer', {
      label: 'layout',
      restore: () => set((state) => updatePanel(state, panelId, {
        currentLayout: prevLayout,
        ...recalcPages(state.panels[panelId].totalImages, prevLayout.spots),
        currentPage: prevPage,
        preDoubleClickLayout: prevPre,
      })),
    });
    const clearSingleViewState = Boolean(panel.preDoubleClickLayout) || (panel.currentLayout.spots === 1 && layout.spots !== 1);
    set((state) => updatePanel(state, panelId, {
      currentLayout: layout,
      ...recalcPages(panel.totalImages, layout.spots),
      ...(clearSingleViewState ? {
        preDoubleClickLayout: null,
        preDoubleClickPage: 1,
        doubleClickViewportImage: null,
      } : {}),
    }));
  },

  panelNextPage: (panelId) => {
    const panel = get().panels[panelId];
    if (panel.currentPage < panel.totalPages) {
      set((state) => updatePanel(state, panelId, { currentPage: panel.currentPage + 1 }));
    }
  },

  panelPrevPage: (panelId) => {
    const panel = get().panels[panelId];
    if (panel.currentPage > 1) {
      set((state) => updatePanel(state, panelId, { currentPage: panel.currentPage - 1 }));
    }
  },

  setPanelPage: (panelId, page) => {
    const panel = get().panels[panelId];
    const clamped = Math.max(1, Math.min(page, panel.totalPages));
    if (clamped !== panel.currentPage) {
      set((state) => updatePanel(state, panelId, { currentPage: clamped }));
    }
  },

  setPanelSelectedViewport: (panelId, index) => {
    set((state) => updatePanel(state, panelId, {
      selectedViewport: index,
      selectedViewportIndices: [index],
    }));
  },

  togglePanelViewportSelection: (panelId, index) => {
    const panel = get().panels[panelId];
    const current = panel.selectedViewportIndices;
    const next = current.includes(index)
      ? current.filter(i => i !== index)
      : [...current, index];
    set((state) => updatePanel(state, panelId, {
      selectedViewportIndices: next.length > 0 ? next : [index],
      selectedViewport: index,
    }));
  },

  selectAllPanelViewports: (panelId) => {
    const panel = get().panels[panelId];
    const totalSpots = panel.currentLayout.spots;
    if (panel.selectedViewportIndices.length === totalSpots) {
      set((state) => updatePanel(state, panelId, {
        selectedViewportIndices: [panel.selectedViewport],
      }));
    } else {
      const indices = Array.from({ length: totalSpots }, (_, i) => i);
      set((state) => updatePanel(state, panelId, {
        selectedViewportIndices: indices,
        selectedViewport: 0,
      }));
    }
  },

  panelSwapImages: (panelId, idxA, idxB) => {
    const prevImages = [...get().panels[panelId].images];
    useUndoStore.getState().push('dualViewer', {
      label: 'swap',
      restore: () => set((state) => updatePanel(state, panelId, { images: prevImages })),
    });
    set((state) => {
      const panel = state.panels[panelId];
      const nextImages = [...panel.images];
      const temp = nextImages[idxA];
      nextImages[idxA] = nextImages[idxB];
      nextImages[idxB] = temp;
      return updatePanel(state, panelId, { images: nextImages });
    });
  },

  togglePanelArrangeMode: (panelId) => {
    const panel = get().panels[panelId];
    if (panel.isArrangeMode) {
      get().applyPanelArrange(panelId);
    } else {
      set((state) => updatePanel(state, panelId, { isArrangeMode: true, arrangeClickOrder: [] }));
    }
  },

  togglePanelArrangeViewport: (panelId, index) => {
    const panel = get().panels[panelId];
    const order = panel.arrangeClickOrder;
    if (order.includes(index)) {
      set((state) => updatePanel(state, panelId, { arrangeClickOrder: order.filter(i => i !== index) }));
    } else if (order.length < panel.currentLayout.spots) {
      set((state) => updatePanel(state, panelId, { arrangeClickOrder: [...order, index] }));
    }
  },

  applyPanelArrange: (panelId) => {
    const panel = get().panels[panelId];
    if (panel.arrangeClickOrder.length === 0) {
      set((state) => updatePanel(state, panelId, { isArrangeMode: false, arrangeClickOrder: [] }));
      return;
    }

    // Snapshot for undo
    const prevImages = [...panel.images];
    const prevLayout = panel.currentLayout;
    const prevPage = panel.currentPage;
    useUndoStore.getState().push('dualViewer', {
      label: 'arrange',
      restore: () => set((state) => updatePanel(state, panelId, {
        images: prevImages,
        currentLayout: prevLayout,
        ...recalcPages(prevImages.length, prevLayout.spots),
        currentPage: prevPage,
      })),
    });

    const startIndex = (panel.currentPage - 1) * panel.currentLayout.spots;
    const selectedCount = panel.arrangeClickOrder.length;
    const arrangedImages: DualImage[] = [];
    for (const vpIdx of panel.arrangeClickOrder) {
      const img = panel.images[startIndex + vpIdx];
      if (img) arrangedImages.push(img);
    }
    const arrangedIds = new Set(arrangedImages.map(img => img.id));
    const remainingImages = panel.images.filter(img => !arrangedIds.has(img.id));
    const newSequence = [...arrangedImages, ...remainingImages];
    const bestLayout = autoSelectLayout(selectedCount);

    set((state) => updatePanel(state, panelId, {
      isArrangeMode: false,
      arrangeClickOrder: [],
      currentLayout: bestLayout,
      images: newSequence,
      ...recalcPages(newSequence.length, bestLayout.spots),
    }));
  },

  resetPanelAll: (panelId) => {
    const panel = get().panels[panelId];
    const defaultLayout = autoSelectLayout(panel.originalImages.length);
    useUndoStore.getState().clear('dualViewer');
    set((state) => ({
      ...updatePanel(state, panelId, {
        images: [...panel.originalImages],
        currentLayout: defaultLayout,
        selectedViewport: 0,
        selectedViewportIndices: [0],
        isArrangeMode: false,
        arrangeClickOrder: [],
        preDoubleClickLayout: null,
        preDoubleClickPage: 1,
        doubleClickViewportImage: null,
        ...recalcPages(panel.originalImages.length, defaultLayout.spots),
      }),
      stampPlacements: state.stampPlacements.filter(s => s.panelId !== panelId),
    }));
  },

  clearPanelViewport: (panelId) => {
    const panel = get().panels[panelId];
    const indicesToClear = panel.selectedViewportIndices.length > 1
      ? panel.selectedViewportIndices
      : [panel.selectedViewport];

    const startIndex = (panel.currentPage - 1) * panel.currentLayout.spots;
    const imageIdsToClear = indicesToClear
      .map(vi => panel.images[startIndex + vi]?.imageUrl)
      .filter(Boolean) as string[];

    set((state) => ({
      stampPlacements: state.stampPlacements.filter(
        s => !(s.panelId === panelId && imageIdsToClear.includes(s.imageId))
      ),
    }));
  },

  setPanelApplyToAll: (panelId, v) => {
    set((state) => updatePanel(state, panelId, { applyToAll: v }));
  },

  togglePanelSingleViewport: (panelId, viewportIndex) => {
    const panel = get().panels[panelId];
    const singleLayout = DUAL_LAYOUTS[0];

    // Snapshot for undo
    const prevLayout = panel.currentLayout;
    const prevPage = panel.currentPage;
    const prevPre = panel.preDoubleClickLayout;
    const prevPrePage = panel.preDoubleClickPage;
    const prevDcImg = panel.doubleClickViewportImage;
    useUndoStore.getState().push('dualViewer', {
      label: 'toggle-zoom',
      restore: () => set((state) => updatePanel(state, panelId, {
        currentLayout: prevLayout,
        ...recalcPages(state.panels[panelId].totalImages, prevLayout.spots),
        currentPage: prevPage,
        preDoubleClickLayout: prevPre,
        preDoubleClickPage: prevPrePage,
        doubleClickViewportImage: prevDcImg,
      })),
    });

    if (panel.preDoubleClickLayout) {
      const prevLayout = panel.preDoubleClickLayout;
      const prevPage = panel.preDoubleClickPage;
      set((state) => updatePanel(state, panelId, {
        currentLayout: prevLayout,
        ...recalcPages(panel.totalImages, prevLayout.spots),
        currentPage: prevPage,
        preDoubleClickLayout: null,
        preDoubleClickPage: 1,
        doubleClickViewportImage: null,
      }));
    } else {
      const startIndex = (panel.currentPage - 1) * panel.currentLayout.spots;
      const actualImageIndex = startIndex + viewportIndex;
      const image = panel.images[actualImageIndex];
      if (!image?.imageUrl) return;
      const targetPage = actualImageIndex + 1; // 1 spot per page in single layout

      set((state) => updatePanel(state, panelId, {
        preDoubleClickLayout: panel.currentLayout,
        preDoubleClickPage: panel.currentPage,
        doubleClickViewportImage: image.imageUrl,
        currentLayout: singleLayout,
        ...recalcPages(panel.totalImages, singleLayout.spots),
        currentPage: targetPage,
      }));
    }
  },

  setPanelViewportImage: (panelId, imageUrl, viewportIndex) => {
    const panel = get().panels[panelId];
    const prevImages = [...panel.images];
    useUndoStore.getState().push('dualViewer', {
      label: 'set-viewport-image',
      restore: () => set((state) => updatePanel(state, panelId, { images: prevImages })),
    });
    const targetGlobalIdx = (panel.currentPage - 1) * panel.currentLayout.spots + viewportIndex;
    const sourceIdx = panel.images.findIndex(img => img.imageUrl === imageUrl);
    if (sourceIdx === -1) return;

    const nextImages = [...panel.images];
    if (targetGlobalIdx < nextImages.length) {
      [nextImages[targetGlobalIdx], nextImages[sourceIdx]] = [nextImages[sourceIdx], nextImages[targetGlobalIdx]];
    } else {
      const lastIdx = nextImages.length - 1;
      if (sourceIdx !== lastIdx) {
        [nextImages[lastIdx], nextImages[sourceIdx]] = [nextImages[sourceIdx], nextImages[lastIdx]];
      }
    }
    set((state) => updatePanel(state, panelId, { images: nextImages }));
  },

  deleteImageFromViewport: (panelId, viewportIndex) => {
    const panel = get().panels[panelId];
    const globalIdx = (panel.currentPage - 1) * panel.currentLayout.spots + viewportIndex;
    const image = panel.images[globalIdx];
    if (!image) return;

    // Snapshot for undo
    const prevImages = [...panel.images];
    const prevPage = panel.currentPage;
    useUndoStore.getState().push('dualViewer', {
      label: 'delete-image',
      restore: () => set((state) => updatePanel(state, panelId, {
        images: prevImages,
        ...recalcPages(prevImages.length, state.panels[panelId].currentLayout.spots),
        currentPage: prevPage,
      })),
    });

    const newImages = panel.images.filter((_, i) => i !== globalIdx);
    const newTotal = newImages.length;
    const spots = panel.currentLayout.spots;
    const newTotalPages = Math.max(1, Math.ceil(newTotal / spots));
    const newCurrentPage = Math.min(panel.currentPage, newTotalPages);

    set((state) => updatePanel(state, panelId, {
      images: newImages,
      totalImages: newTotal,
      totalPages: newTotalPages,
      currentPage: newCurrentPage,
    }));
  },

  // ── Active Panel ──

  setActivePanel: (panelId) => set({ activePanel: panelId }),
  setSyncMove: (v) => set({ syncMove: v }),

  activeNextPage: () => { const { activePanel } = get(); get().panelNextPage(activePanel); },
  activePrevPage: () => { const { activePanel } = get(); get().panelPrevPage(activePanel); },
  activeSelectAll: () => { const { activePanel } = get(); get().selectAllPanelViewports(activePanel); },
  activeResetAll: () => { const { activePanel } = get(); get().resetPanelAll(activePanel); },
  activeClear: () => { const { activePanel } = get(); get().clearPanelViewport(activePanel); },

  // ── Arrange Both ──

  toggleBothArrangeMode: () => {
    const { panels } = get();
    const leftArranging = panels.left.isArrangeMode;
    const rightArranging = panels.right.isArrangeMode;

    if (leftArranging || rightArranging) {
      // Apply both
      if (leftArranging) get().applyPanelArrange('left');
      if (rightArranging) get().applyPanelArrange('right');
    } else {
      // Enter arrange mode on both
      set((state) => ({
        panels: {
          left: { ...state.panels.left, isArrangeMode: true, arrangeClickOrder: [] },
          right: { ...state.panels.right, isArrangeMode: true, arrangeClickOrder: [] },
        },
      }));
    }
  },

  // ── Stamps ──

  addStamp: (stamp) => {
    const id = `dstamp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newStamp: DualStamp = { ...stamp, id, createdAt: Date.now() };
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

  placeStamp: (panelId, imageId, xPercent, yPercent, containerHeight) => {
    const { activeStampId, stamps, stampPlacements } = get();
    const stamp = stamps.find(s => s.id === activeStampId);
    if (!stamp) return;

    const prevPlacements = [...stampPlacements];
    useUndoStore.getState().push('dualViewer', {
      label: 'place-stamp',
      restore: () => set({ stampPlacements: prevPlacements }),
    });

    const placement: DualStampPlacement = {
      id: `dsp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      stampId: stamp.id,
      panelId,
      text: stamp.text,
      color: stamp.color,
      fontSize: stamp.fontSize,
      fontSizePercent: containerHeight ? (stamp.fontSize / containerHeight) * 100 : undefined,
      imageId,
      xPercent,
      yPercent,
    };

    set((state) => ({
      stampPlacements: [...state.stampPlacements, placement],
      isStampMode: false,
      activeStampId: null,
    }));
  },

  removeStampPlacement: (id) => {
    const prevPlacements = [...get().stampPlacements];
    useUndoStore.getState().push('dualViewer', {
      label: 'remove-stamp',
      restore: () => set({ stampPlacements: prevPlacements }),
    });
    set((state) => ({ stampPlacements: state.stampPlacements.filter(s => s.id !== id) }));
  },

  updateStampPlacement: (id, xPercent, yPercent) => {
    set((state) => ({
      stampPlacements: state.stampPlacements.map(s => s.id === id ? { ...s, xPercent, yPercent } : s),
    }));
  },

  undoStampPlacement: () => {
    set((state) => ({ stampPlacements: state.stampPlacements.slice(0, -1) }));
  },

  clearStampPlacements: (panelId, viewportIndex) => {
    if (panelId !== undefined && viewportIndex !== undefined) {
      const panel = get().panels[panelId];
      const startIndex = (panel.currentPage - 1) * panel.currentLayout.spots;
      const imageId = panel.images[startIndex + viewportIndex]?.imageUrl;
      if (!imageId) return;
      set((state) => ({
        stampPlacements: state.stampPlacements.filter(
          s => !(s.panelId === panelId && s.imageId === imageId)
        ),
      }));
    } else if (panelId !== undefined) {
      set((state) => ({
        stampPlacements: state.stampPlacements.filter(s => s.panelId !== panelId),
      }));
    } else {
      set({ stampPlacements: [] });
    }
  },

  setShowLogo: (v) => set({ showLogo: v }),

  updateDualFooterField: (key, value) => set((s) => ({ ...s, [key]: value })),
  updateDualFooterLayout: (slot, value) => set((s) => ({ dualFooterLayout: { ...s.dualFooterLayout, [slot]: value } })),

  // ── Text ──

  setTextMode: (v) => set({ isTextMode: v, isStampMode: false }),

  placeTextDirect: (panelId, imageId, xPercent, yPercent, text, color, fontSize, containerHeight) => {
    const prevPlacements = [...get().stampPlacements];
    useUndoStore.getState().push('dualViewer', {
      label: 'place-text',
      restore: () => set({ stampPlacements: prevPlacements }),
    });
    const placement: DualStampPlacement = {
      id: `dsp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      stampId: 'text',
      panelId,
      text,
      color,
      fontSize,
      fontSizePercent: containerHeight ? (fontSize / containerHeight) * 100 : undefined,
      imageId,
      xPercent,
      yPercent,
      type: 'text',
    };
    set((state) => ({
      stampPlacements: [...state.stampPlacements, placement],
      isTextMode: false,
    }));
  },
})});

// ── Launch Function ──

export interface DualStudyParams {
  patientName: string;
  patientId: string;
  studyDate: string;
  filePaths: string[];
}

export async function openDualViewerPopup(
  params: { leftStudy: DualStudyParams; rightStudy: DualStudyParams },
  navigate: (path: string) => void,
) {
  localStorage.setItem('dual-viewer-launch', JSON.stringify({
    leftStudy: params.leftStudy,
    rightStudy: params.rightStudy,
    timestamp: Date.now(),
  }));

  const api = (window as any).electronAPI;
  if (api?.openDualViewer) {
    try {
      await api.openDualViewer();
      return;
    } catch (e) {
      console.warn('Failed to open dual viewer popup, falling back to navigation:', e);
    }
  }

  // Fallback: load studies and navigate
  const store = useDualViewerStore.getState();
  store.loadPanelStudy('left', params.leftStudy);
  store.loadPanelStudy('right', params.rightStudy);
  navigate('/dual-viewer');
}

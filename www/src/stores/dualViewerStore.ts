/**
 * dualViewerStore — Independent state management for the Dual comparison viewer.
 * Two independent panel states (left/right), shared stamps, active panel tracking.
 * Completely separate from viewerStore and crViewerStore.
 */
import { create } from 'zustand';
import { localFileToImageId, prefetchImages } from '@/lib/dicomLoader';

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
  viewportIndex: number;
  xPercent: number;
  yPercent: number;
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

  // UI
  isLoading: boolean;
  showLogo: boolean;

  // Panel actions
  loadPanelStudy: (panelId: PanelId, params: {
    patientName: string; patientId: string; studyDate: string; filePaths: string[];
  }) => void;
  setPanelLayout: (panelId: PanelId, layout: DualLayout) => void;
  panelNextPage: (panelId: PanelId) => void;
  panelPrevPage: (panelId: PanelId) => void;
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

  // Active panel
  setActivePanel: (panelId: PanelId) => void;

  // Active-panel convenience wrappers
  activeNextPage: () => void;
  activePrevPage: () => void;
  activeSelectAll: () => void;
  activeResetAll: () => void;
  activeClear: () => void;

  // Stamps
  addStamp: (stamp: Omit<DualStamp, 'id' | 'createdAt'>) => void;
  removeStamp: (id: string) => void;
  setActiveStamp: (id: string | null) => void;
  setStampMode: (v: boolean) => void;
  placeStamp: (panelId: PanelId, viewportIndex: number, xPercent: number, yPercent: number) => void;
  removeStampPlacement: (id: string) => void;
  updateStampPlacement: (id: string, xPercent: number, yPercent: number) => void;
  undoStampPlacement: () => void;
  clearStampPlacements: (panelId?: PanelId, viewportIndex?: number) => void;

  // Logo
  setShowLogo: (v: boolean) => void;
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

export const useDualViewerStore = create<DualViewerState>((set, get) => ({
  panels: { left: createDefaultPanelState(), right: createDefaultPanelState() },
  activePanel: 'left',
  stamps: loadSavedStamps(),
  stampPlacements: [],
  isStampMode: false,
  activeStampId: null,
  isLoading: false,
  showLogo: true,

  // ── Panel Actions ──

  loadPanelStudy: (panelId, params) => {
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
    set((state) => updatePanel(state, panelId, {
      currentLayout: layout,
      ...recalcPages(panel.totalImages, layout.spots),
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

    set((state) => ({
      stampPlacements: state.stampPlacements.filter(
        s => !(s.panelId === panelId && indicesToClear.includes(s.viewportIndex))
      ),
    }));
  },

  setPanelApplyToAll: (panelId, v) => {
    set((state) => updatePanel(state, panelId, { applyToAll: v }));
  },

  togglePanelSingleViewport: (panelId, viewportIndex) => {
    const panel = get().panels[panelId];
    const singleLayout = DUAL_LAYOUTS[0];

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
      const image = panel.images[startIndex + viewportIndex];
      if (!image?.imageUrl) return;

      set((state) => updatePanel(state, panelId, {
        preDoubleClickLayout: panel.currentLayout,
        preDoubleClickPage: panel.currentPage,
        doubleClickViewportImage: image.imageUrl,
        currentLayout: singleLayout,
        ...recalcPages(panel.totalImages, singleLayout.spots),
        currentPage: 1,
      }));
    }
  },

  setPanelViewportImage: (panelId, imageUrl, viewportIndex) => {
    const panel = get().panels[panelId];
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

  // ── Active Panel ──

  setActivePanel: (panelId) => set({ activePanel: panelId }),

  activeNextPage: () => { const { activePanel } = get(); get().panelNextPage(activePanel); },
  activePrevPage: () => { const { activePanel } = get(); get().panelPrevPage(activePanel); },
  activeSelectAll: () => { const { activePanel } = get(); get().selectAllPanelViewports(activePanel); },
  activeResetAll: () => { const { activePanel } = get(); get().resetPanelAll(activePanel); },
  activeClear: () => { const { activePanel } = get(); get().clearPanelViewport(activePanel); },

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

  placeStamp: (panelId, viewportIndex, xPercent, yPercent) => {
    const { activeStampId, stamps } = get();
    const stamp = stamps.find(s => s.id === activeStampId);
    if (!stamp) return;

    const placement: DualStampPlacement = {
      id: `dsp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      stampId: stamp.id,
      panelId,
      text: stamp.text,
      color: stamp.color,
      fontSize: stamp.fontSize,
      viewportIndex,
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
      set((state) => ({
        stampPlacements: state.stampPlacements.filter(
          s => !(s.panelId === panelId && s.viewportIndex === viewportIndex)
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
}));

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

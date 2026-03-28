import { create } from 'zustand';

export interface TextAnnotation {
  id: string;
  text: string;
  xPercent: number;
  yPercent: number;
  color: string;
  fontSize: number;
  type: 'text' | 'stamp';
}

export interface DrawPath {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
}

interface HistoryItem {
  type: 'add_text' | 'remove_text' | 'move_text' | 'add_path' | 'remove_path';
  imageId: string;
  data: any; // The annotation or old state
}

interface CustomAnnotationState {
  // imageId -> annotations
  annotations: Record<string, TextAnnotation[]>;
  // imageId -> drawPaths
  drawPaths: Record<string, DrawPath[]>;
  
  history: HistoryItem[];

  // Actions
  addText: (imageId: string, ann: TextAnnotation, isUndoable?: boolean) => void;
  removeText: (imageId: string, annId: string, isUndoable?: boolean) => void;
  updateText: (imageId: string, ann: TextAnnotation, oldState?: any) => void;
  
  addPath: (imageId: string, path: DrawPath, isUndoable?: boolean) => void;
  removePath: (imageId: string, pathId: string, isUndoable?: boolean) => void;
  
  undo: () => void;
  resetAll: () => void;
  clearForImageId: (imageId: string) => void;

  getAnnotations: (imageId: string) => TextAnnotation[];
  getDrawPaths: (imageId: string) => DrawPath[];
}

export const useCustomAnnotationStore = create<CustomAnnotationState>((set, get) => ({
  annotations: {},
  drawPaths: {},
  history: [],

  getAnnotations: (imageId) => get().annotations[imageId] || [],
  getDrawPaths: (imageId) => get().drawPaths[imageId] || [],

  addText: (imageId, ann, isUndoable = true) => {
    set((state) => {
      const list = state.annotations[imageId] || [];
      const nextHistory = isUndoable 
        ? [...state.history, { type: 'add_text', imageId, data: ann } as HistoryItem]
        : state.history;
      
      return {
        annotations: { ...state.annotations, [imageId]: [...list, ann] },
        history: nextHistory.slice(-50) // limit history
      };
    });
    window.dispatchEvent(new CustomEvent('dicom-annotations-updated', { detail: { imageId } }));
  },

  removeText: (imageId, annId, isUndoable = true) => {
    const ann = (get().annotations[imageId] || []).find(a => a.id === annId);
    if (!ann) return;

    set((state) => {
      const list = state.annotations[imageId] || [];
      const nextHistory = isUndoable 
        ? [...state.history, { type: 'remove_text', imageId, data: ann } as HistoryItem]
        : state.history;

      return {
        annotations: { ...state.annotations, [imageId]: list.filter(a => a.id !== annId) },
        history: nextHistory.slice(-50)
      };
    });
    window.dispatchEvent(new CustomEvent('dicom-annotations-updated', { detail: { imageId } }));
  },

  updateText: (imageId, ann, oldState) => {
    set((state) => {
      const list = state.annotations[imageId] || [];
      const nextHistory = oldState 
        ? [...state.history, { type: 'move_text', imageId, data: oldState } as HistoryItem]
        : state.history;

      return {
        annotations: { 
          ...state.annotations, 
          [imageId]: list.map(a => a.id === ann.id ? ann : a) 
        },
        history: nextHistory.slice(-50)
      };
    });
    window.dispatchEvent(new CustomEvent('dicom-annotations-updated', { detail: { imageId } }));
  },

  addPath: (imageId, path, isUndoable = true) => {
    set((state) => {
      const list = state.drawPaths[imageId] || [];
      const nextHistory = isUndoable 
        ? [...state.history, { type: 'add_path', imageId, data: path } as HistoryItem]
        : state.history;

      return {
        drawPaths: { ...state.drawPaths, [imageId]: [...list, path] },
        history: nextHistory.slice(-50)
      };
    });
    window.dispatchEvent(new CustomEvent('dicom-annotations-updated', { detail: { imageId } }));
  },

  removePath: (imageId, pathId, isUndoable = true) => {
    const path = (get().drawPaths[imageId] || []).find(p => p.id === pathId);
    if (!path) return;

    set((state) => {
      const list = state.drawPaths[imageId] || [];
      const nextHistory = isUndoable 
        ? [...state.history, { type: 'remove_path', imageId, data: path } as HistoryItem]
        : state.history;

      return {
        drawPaths: { ...state.drawPaths, [imageId]: list.filter(p => p.id !== pathId) },
        history: nextHistory.slice(-50)
      };
    });
    window.dispatchEvent(new CustomEvent('dicom-annotations-updated', { detail: { imageId } }));
  },

  undo: () => {
    const history = get().history;
    if (history.length === 0) return;

    const last = history[history.length - 1];
    set(state => ({ history: state.history.slice(0, -1) }));

    const { imageId, type, data } = last;

    switch (type) {
      case 'add_text':
        get().removeText(imageId, data.id, false);
        break;
      case 'remove_text':
        get().addText(imageId, data, false);
        break;
      case 'move_text':
        // data is the old state
        get().updateText(imageId, data, undefined);
        break;
      case 'add_path':
        get().removePath(imageId, data.id, false);
        break;
      case 'remove_path':
        get().addPath(imageId, data, false);
        break;
    }
  },

  clearForImageId: (imageId: string) => {
    set((state) => ({
      annotations: { ...state.annotations, [imageId]: [] },
      drawPaths: { ...state.drawPaths, [imageId]: [] },
    }));
  },

  resetAll: () => {
    set({ annotations: {}, drawPaths: {}, history: [] });
    window.dispatchEvent(new CustomEvent('dicom-clear-annotations'));
  }
}));

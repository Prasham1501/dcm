/**
 * undoStore — Unified undo system for all three viewers.
 *
 * Stores snapshots of state before each undoable action. On undo, restores
 * the most recent snapshot and performs any necessary side-effects (e.g.
 * restoring cornerstone tool annotations).
 *
 * Each viewer scope ('viewer' | 'crViewer' | 'dualViewer') has its own
 * independent undo stack so they don't interfere with each other.
 */
import { create } from 'zustand';

export type UndoScope = 'viewer' | 'crViewer' | 'dualViewer';

export interface UndoEntry {
  /** Human-readable label (for debugging) */
  label: string;
  /** The function that reverses this action */
  restore: () => void;
}

interface UndoState {
  stacks: Record<UndoScope, UndoEntry[]>;
  push: (scope: UndoScope, entry: UndoEntry) => void;
  undo: (scope: UndoScope) => boolean;
  clear: (scope: UndoScope) => void;
  canUndo: (scope: UndoScope) => boolean;
  size: (scope: UndoScope) => number;
}

const MAX_UNDO = 80;

export const useUndoStore = create<UndoState>((set, get) => ({
  stacks: {
    viewer: [],
    crViewer: [],
    dualViewer: [],
  },

  push: (scope, entry) => {
    set((state) => {
      const stack = [...state.stacks[scope], entry];
      if (stack.length > MAX_UNDO) stack.splice(0, stack.length - MAX_UNDO);
      return { stacks: { ...state.stacks, [scope]: stack } };
    });
  },

  undo: (scope) => {
    const stack = get().stacks[scope];
    if (stack.length === 0) return false;
    const entry = stack[stack.length - 1];
    set((state) => ({
      stacks: { ...state.stacks, [scope]: state.stacks[scope].slice(0, -1) },
    }));
    entry.restore();
    return true;
  },

  clear: (scope) => {
    set((state) => ({
      stacks: { ...state.stacks, [scope]: [] },
    }));
  },

  canUndo: (scope) => get().stacks[scope].length > 0,

  size: (scope) => get().stacks[scope].length,
}));

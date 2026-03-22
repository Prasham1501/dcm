import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'light' | 'dark';

export interface DarkThemeColor {
  id: string;
  name: string;
  bg: string;
  surface: string;
  headerBg: string;
  hover: string;
  border: string;
  accent: string;
  accentHover: string;
}

export const DARK_THEME_COLORS: DarkThemeColor[] = [
  { id: 'midnight-red', name: 'Midnight Red', bg: '#1a1a2e', surface: '#16213e', headerBg: '#0f3460', hover: '#1a3a5c', border: '#2a4a6b', accent: '#e94560', accentHover: '#c73851' },
  { id: 'ocean-blue', name: 'Ocean Blue', bg: '#0d1b2a', surface: '#1b2838', headerBg: '#1b3a4b', hover: '#254a5e', border: '#2c5f6e', accent: '#3a86ff', accentHover: '#2563eb' },
  { id: 'forest-green', name: 'Forest Green', bg: '#1a1a1a', surface: '#1e2a1e', headerBg: '#1e3a2e', hover: '#2a4a3a', border: '#3a5a4a', accent: '#22c55e', accentHover: '#16a34a' },
  { id: 'royal-purple', name: 'Royal Purple', bg: '#1a1625', surface: '#201e30', headerBg: '#2d1b69', hover: '#3a2a5c', border: '#4a3a6b', accent: '#a855f7', accentHover: '#9333ea' },
  { id: 'warm-amber', name: 'Warm Amber', bg: '#1c1917', surface: '#292524', headerBg: '#3b2f2f', hover: '#44403c', border: '#57534e', accent: '#f59e0b', accentHover: '#d97706' },
  { id: 'teal-cyan', name: 'Teal Cyan', bg: '#0f1419', surface: '#1a2332', headerBg: '#0d3b4e', hover: '#1a4a5e', border: '#2a5a6e', accent: '#06b6d4', accentHover: '#0891b2' },
  { id: 'rose-pink', name: 'Rose Pink', bg: '#1a1018', surface: '#251820', headerBg: '#3d1f35', hover: '#4a2a42', border: '#5a3a52', accent: '#f43f5e', accentHover: '#e11d48' },
  { id: 'slate-gray', name: 'Slate Gray', bg: '#111827', surface: '#1e293b', headerBg: '#1f2937', hover: '#374151', border: '#4b5563', accent: '#6b7280', accentHover: '#4b5563' },
];

interface ThemeState {
  mode: ThemeMode;
  darkColorId: string;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  setDarkColor: (id: string) => void;
}

function applyDarkColor(colorId: string) {
  const color = DARK_THEME_COLORS.find(c => c.id === colorId) || DARK_THEME_COLORS[0];
  const root = document.documentElement;
  root.style.setProperty('--app-bg-dark', color.bg);
  root.style.setProperty('--app-surface-dark', color.surface);
  root.style.setProperty('--app-header-bg-dark', color.headerBg);
  root.style.setProperty('--app-hover-dark', color.hover);
  root.style.setProperty('--app-border-dark', color.border);
  root.style.setProperty('--app-accent-dark', color.accent);
  root.style.setProperty('--app-accent-hover-dark', color.accentHover);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      darkColorId: 'midnight-red',
      toggleTheme: () =>
        set((state) => {
          const newMode = state.mode === 'light' ? 'dark' : 'light';
          if (newMode === 'dark') {
            applyDarkColor(state.darkColorId);
          }
          return { mode: newMode };
        }),
      setTheme: (mode) => {
        if (mode === 'dark') {
          applyDarkColor(get().darkColorId);
        }
        set({ mode });
      },
      setDarkColor: (id) => {
        set({ darkColorId: id });
        if (get().mode === 'dark') {
          applyDarkColor(id);
        }
      },
    }),
    {
      name: 'dicom-viewer-theme',
    }
  )
);

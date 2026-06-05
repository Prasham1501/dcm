/** @type {import('tailwindcss').Config} */
export default {
  // Scan both the local RIS UI AND the viewer's source (because we import
  // pages directly from ../../www/src/features/**).
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../www/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'app-bg': 'var(--app-bg)',
        'app-surface': 'var(--app-surface)',
        'app-header-bg': 'var(--app-header-bg)',
        'app-hover': 'var(--app-hover)',
        'app-border': 'var(--app-border)',
        'app-accent': 'var(--app-accent)',
        'app-accent-hover': 'var(--app-accent-hover)',
        'app-text': 'var(--app-text)',
        'app-text-secondary': 'var(--app-text-secondary)',
        'app-text-muted': 'var(--app-text-muted)',
        background: {
          DEFAULT: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          hover: 'var(--bg-hover)',
          active: 'var(--bg-active)',
        },
        foreground: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        border: {
          DEFAULT: 'var(--border-primary)',
          secondary: 'var(--border-secondary)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          light: 'var(--accent-light)',
        },
        danger:  { DEFAULT: 'var(--danger)',  hover: 'var(--danger-hover)' },
        success: { DEFAULT: 'var(--success)' },
        warning: { DEFAULT: 'var(--warning)' },
      },
      fontFamily: {
        sans: ['Segoe UI', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

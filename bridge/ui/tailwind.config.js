/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
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
        'app-thumbnail-bg': 'var(--app-thumbnail-bg)',
        'app-statusbar-bg': 'var(--app-statusbar-bg)',
        'app-viewer-bg': 'var(--app-viewer-bg)',
      },
      fontFamily: {
        sans: ['Segoe UI', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': '0.625rem',
      },
    },
  },
  plugins: [],
};

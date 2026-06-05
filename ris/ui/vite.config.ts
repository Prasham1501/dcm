import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // More-specific aliases first. RIS-owned features live locally now —
      // the rest of `@/...` still maps to the viewer's www/src (stores,
      // services, types, utils, components).
      { find: /^@\/features\/(.*)$/, replacement: path.resolve(__dirname, 'src/features/$1') },
      { find: /^@\/components\/(.*)$/, replacement: path.resolve(__dirname, 'src/components/$1') },
      // RIS-local overrides (auth flow needs to handle flat PHP responses).
      { find: /^@\/stores\/authStore$/, replacement: path.resolve(__dirname, 'src/stores/authStore.ts') },
      { find: '@', replacement: path.resolve(__dirname, '../../www/src') },
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8081',  // bundled PHP server (started by RIS or Viewer)
        changeOrigin: true,
      },
    },
  },
});

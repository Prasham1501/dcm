import { defineConfig } from 'vitest/config';
import path from 'path';

// Frontend unit tests for RIS logic (stores, form/util helpers).
// Pure-logic tests run in the node environment; add jsdom later if/when
// we unit-test React components directly.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

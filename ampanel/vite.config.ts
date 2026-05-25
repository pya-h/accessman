/// <reference types="vitest" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  test: {
    environment: 'jsdom',
    css: { modules: { classNameStrategy: 'non-scoped' } },
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});

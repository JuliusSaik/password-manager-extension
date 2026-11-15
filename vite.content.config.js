import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Content script'as -> vienas IIFE failas dist/content.js
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/content/index.js'),
      name: 'KeyVaultContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});

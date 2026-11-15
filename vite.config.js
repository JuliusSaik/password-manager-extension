import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Pagrindinis build'as: popup (React) + background service worker (ES modulis).
// Content script'as buildinamas atskirai (vite.content.config.js), nes Chrome
// content script'ai negali būti ES moduliai – jiems reikia vieno IIFE failo.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: false, // dist išvalomas "clean" skripte, kad neištrintų content.js
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, 'index.html'),
        background: resolve(import.meta.dirname, 'src/background/index.js'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
      },
    },
  },
});

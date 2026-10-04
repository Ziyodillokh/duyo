import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative, so the built site works from any path — duyo.uz/web, a
  // subfolder on the VPS, or a file:// preview — without a rebuild.
  base: './',
  build: {
    rollupOptions: {
      // Two pages, one bundle of shared code: the home page's film and the
      // DUYO Robot page's (robot/index.html → duyo.uz/robot/).
      input: {
        main: resolve(__dirname, 'index.html'),
        robot: resolve(__dirname, 'robot/index.html'),
      },
    },
  },
});

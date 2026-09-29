import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative, so the built site works from any path — duyo.uz/web, a
  // subfolder on the VPS, or a file:// preview — without a rebuild.
  base: './',
});

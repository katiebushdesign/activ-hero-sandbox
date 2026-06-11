import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/activ-hero-sandbox/',
  root: '.',
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        plasma: resolve(__dirname, 'plasma-only.html'),
      },
    },
  },
  server: {
    open: true,
  },
});

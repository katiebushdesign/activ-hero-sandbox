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
        image: resolve(__dirname, 'hero-image.html'),
        plasmaDark: resolve(__dirname, 'plasma-dark.html'),
      },
    },
  },
  server: {
    open: true,
  },
});

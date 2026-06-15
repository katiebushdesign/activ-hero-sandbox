import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

function getBuildId() {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.slice(0, 7);
  }

  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return Date.now().toString(36);
  }
}

const buildId = getBuildId();

/** Append ?v=<buildId> to public assets and internal HTML links. */
function cacheBustPlugin(id) {
  const publicAsset = /(?<=(?:href|src|poster)=")(?:\/)?assets\/[^"?]+(?=")/g;
  const htmlLink = /(?<=href=")(?!https?:|#|\/)([a-z-]+\.html)(?=")/g;

  return {
    name: 'cache-bust',
    transformIndexHtml(html) {
      let output = html.replace(publicAsset, (match) => `${match}?v=${id}`);
      output = output.replace(htmlLink, (match) => `${match}?v=${id}`);

      if (!output.includes('name="build"')) {
        output = output.replace(
          '<meta name="viewport"',
          `<meta name="build" content="${id}" />\n    <meta http-equiv="Cache-Control" content="no-cache" />\n    <meta name="viewport"`,
        );
      }

      return output;
    },
  };
}

export default defineConfig({
  base: '/activ-hero-sandbox/',
  root: '.',
  publicDir: 'public',
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
  },
  plugins: [cacheBustPlugin(buildId)],
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
    open: '/activ-hero-sandbox/',
  },
});

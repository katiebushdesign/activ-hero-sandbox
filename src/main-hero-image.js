import { HeroScene } from './hero/HeroScene.js';

const hero = document.getElementById('hero');
const canvas = document.getElementById('hero-canvas');
const bgMedia = document.getElementById('hero-bg-media');
const videoEl = document.getElementById('hero-video');
const videoBtn = document.getElementById('hero-video-btn');

if (!hero || !canvas) {
  throw new Error('Hero container or canvas not found');
}

function showFallback() {
  canvas.hidden = true;
  bgMedia?.classList.add('is-fallback-only');
  document.body.dataset.webgl = 'fallback';
}

let scene;

try {
  scene = new HeroScene({
    canvas,
    container: hero,
    pointerElement: canvas,
    preferredImage: 'assets/hero-focused.jpg',
    preserveBackground: true,
    videoEl,
    onMediaModeChange: (mode) => {
      bgMedia?.classList.toggle('is-video', mode === 'video');
    },
    onMediaReady: () => {
      document.body.dataset.webgl = 'ready';
    },
    onMediaFailed: () => {
      showFallback();
    },
  });
} catch (error) {
  console.error('[activ-hero] WebGL unavailable — static image fallback only.', error);
  showFallback();
}

if (scene && videoBtn && videoEl) {
  videoBtn.addEventListener('click', async () => {
    const playing = await scene.useVideoBackground();
    if (!playing) {
      scene.useImageBackground();
      videoBtn.textContent = 'Video unavailable';
      videoBtn.disabled = true;
    }
  });

  window.addEventListener('beforeunload', () => scene.dispose());
}

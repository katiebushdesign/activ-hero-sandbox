import { HeroScene } from './hero/HeroScene.js';

const hero = document.getElementById('hero');
const canvas = document.getElementById('hero-canvas');
const videoEl = document.getElementById('hero-video');
const videoBtn = document.getElementById('hero-video-btn');

if (!hero || !canvas) {
  throw new Error('Hero container or canvas not found');
}

const scene = new HeroScene({
  canvas,
  container: hero,
  videoEl,
});

if (videoBtn) {
  videoBtn.addEventListener('click', async () => {
    const playing = await scene.useVideoBackground();
    if (!playing) {
      scene.useImageBackground();
      videoBtn.textContent = 'Video unavailable';
      videoBtn.disabled = true;
    }
  });
}

window.addEventListener('beforeunload', () => scene.dispose());

import { HeroScene } from './hero/HeroScene.js';

const hero = document.getElementById('hero');
const canvas = document.getElementById('hero-canvas');

if (!hero || !canvas) {
  throw new Error('Hero container or canvas not found');
}

const scene = new HeroScene({
  canvas,
  container: hero,
  skipBackground: true,
  plasmaIdleBg: '#000000',
});

window.addEventListener('beforeunload', () => scene.dispose());

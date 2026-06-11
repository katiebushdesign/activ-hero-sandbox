import * as THREE from 'three';
import { assetUrl } from '../assetUrl.js';
import { PlasmaEffect } from './PlasmaEffect.js';
import { PointerTracker } from './PointerTracker.js';

export class HeroScene {
  constructor({ canvas, container, videoEl }) {
    this.canvas = canvas;
    this.container = container;
    this.videoEl = videoEl;
    this.isVisible = true;
    this.isRunning = false;
    this.rafId = null;
    this.lastTime = performance.now();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.plasma = new PlasmaEffect(this.renderer);
    this.pointer = new PointerTracker(container);

    this.backgroundTexture = null;
    this.videoTexture = null;
    this.mediaMode = 'image';
    this._videoCoverReady = false;

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);

    this._motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._onMotionChange = (e) => this.plasma.setReducedMotion(e.matches);
    this._motionQuery.addEventListener('change', this._onMotionChange);

    this._observer = new IntersectionObserver(
      (entries) => {
        this.isVisible = entries[0]?.isIntersecting ?? true;
        if (this.isVisible) {
          this.start();
        } else {
          this.stop();
        }
      },
      { threshold: 0.05 }
    );
    this._observer.observe(container);

    this._onResize();
    this._initMedia();
  }

  async _initMedia() {
    const image = await this._loadHeroImage();
    this.backgroundTexture = image;
    this.plasma.setBackground(image, { isVideo: false });

    if (this.videoEl) {
      this._bindVideoCoverEvents();
      this.videoTexture = new THREE.VideoTexture(this.videoEl);
      this.videoTexture.colorSpace = THREE.SRGBColorSpace;
      this.videoTexture.minFilter = THREE.LinearFilter;
      this.videoTexture.magFilter = THREE.LinearFilter;

      await this._waitForVideoMetadata();

      const canPlay = await this._tryPlayVideo();
      if (canPlay) {
        this.mediaMode = 'video';
        this.plasma.setBackground(this.videoTexture, { isVideo: true });
        this._refreshActiveMediaCover();
      }
    }

    this.start();
  }

  async _loadHeroImage() {
    const sources = [
      assetUrl('assets/hero-focused.jpg'),
      assetUrl('assets/hero-figma.jpg'),
      assetUrl('assets/hero-surgery.jpg'),
    ];

    for (const url of sources) {
      try {
        return await this._loadTexture(url);
      } catch {
        // try next source
      }
    }

    throw new Error('No hero background image found in /public/assets');
  }

  _loadTexture(url) {
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          this.plasma.refreshBackgroundCover(texture);
          resolve(texture);
        },
        undefined,
        reject
      );
    });
  }

  _bindVideoCoverEvents() {
    const refresh = () => this._refreshActiveMediaCover();
    this.videoEl.addEventListener('loadedmetadata', refresh);
    this.videoEl.addEventListener('loadeddata', refresh);
    this.videoEl.addEventListener('resize', refresh);
  }

  _waitForVideoMetadata() {
    if (!this.videoEl) return Promise.resolve();
    if (this.videoEl.readyState >= 1 && this.videoEl.videoWidth > 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const done = () => {
        if (this.videoEl.videoWidth > 0) {
          this.videoEl.removeEventListener('loadedmetadata', done);
          this.videoEl.removeEventListener('loadeddata', done);
          resolve();
        }
      };
      this.videoEl.addEventListener('loadedmetadata', done);
      this.videoEl.addEventListener('loadeddata', done);
      this.videoEl.load();
    });
  }

  _refreshActiveMediaCover() {
    const texture =
      this.mediaMode === 'video' ? this.videoTexture : this.backgroundTexture;
    if (!texture) return;

    const ready = this.plasma.refreshBackgroundCover(texture);
    if (this.mediaMode === 'video') {
      this._videoCoverReady = ready;
    }
  }

  async _tryPlayVideo() {
    if (!this.videoEl) return false;

    const hasSource = this.videoEl.querySelector('source')?.getAttribute('src');
    if (!hasSource) return false;

    try {
      await this.videoEl.play();
      return !this.videoEl.paused;
    } catch {
      return false;
    }
  }

  useImageBackground() {
    if (this.backgroundTexture) {
      this.mediaMode = 'image';
      this._videoCoverReady = false;
      this.plasma.setBackground(this.backgroundTexture, { isVideo: false });
      this._refreshActiveMediaCover();
    }
  }

  async useVideoBackground() {
    if (!this.videoEl || !this.videoTexture) return false;
    const ok = await this._tryPlayVideo();
    if (ok) {
      this.mediaMode = 'video';
      this.plasma.setBackground(this.videoTexture, { isVideo: true });
      this._refreshActiveMediaCover();
    }
    return ok;
  }

  _onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.plasma.setSize(width * dpr, height * dpr);
  }

  _tick = (now) => {
    if (!this.isRunning) return;

    const delta = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.mediaMode === 'video' && this.videoTexture) {
      this.videoTexture.needsUpdate = true;
      if (!this._videoCoverReady) {
        this._refreshActiveMediaCover();
      }
    }

    this.pointer.update(delta);
    this.plasma.updatePointer({
      x: this.pointer.position.x,
      y: this.pointer.position.y,
      velocity: this.pointer.smoothedVelocity,
      isActive: this.pointer.isActive,
    });

    this.plasma.tick(delta);
    this.plasma.updateTrail(delta);
    this.plasma.render();

    this.rafId = requestAnimationFrame(this._tick);
  };

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    this._motionQuery.removeEventListener('change', this._onMotionChange);
    this._observer.disconnect();
    this.pointer.dispose();
    this.plasma.dispose();
    this.backgroundTexture?.dispose();
    this.videoTexture?.dispose();
    this.renderer.dispose();
  }
}

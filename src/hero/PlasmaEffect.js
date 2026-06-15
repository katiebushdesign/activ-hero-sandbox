import * as THREE from 'three';
import plasmaVert from '../shaders/plasma.vert?raw';
import plasmaFrag from '../shaders/plasma.frag?raw';
import trailVert from '../shaders/trail.vert?raw';
import trailFrag from '../shaders/trail.frag?raw';
import { setBackgroundCoverUniforms } from './backgroundUv.js';

export const TUNING = {
  PLASMA_MASK_LEFT: 1.0,
  TRAIL_DECAY: 0.965,
  PIXEL_MAX: 48,
  VELOCITY_SENSITIVITY: 1.2,
  STAMP_STRENGTH: 0.7,
  TRAIL_SCALE: 0.85,
};

export class PlasmaEffect {
  constructor(renderer) {
    this.renderer = renderer;
    this.trailIndex = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uMouseVel: { value: 0 },
      uBackground: { value: null },
      uTrail: { value: null },
      uPlasmaMaskLeft: { value: TUNING.PLASMA_MASK_LEFT },
      uPixelMax: { value: TUNING.PIXEL_MAX },
      uVelocitySensitivity: { value: TUNING.VELOCITY_SENSITIVITY },
      uUseVideo: { value: false },
      uHasBackground: { value: true },
      uBackgroundCover: { value: new THREE.Vector4(1, 1, 0, 0) },
      uPointerActive: { value: 0 },
      uIdleBg: { value: new THREE.Vector3(0.898039, 0.898039, 0.905882) },
    };

    this._viewportWidth = 1;
    this._viewportHeight = 1;

    this.trailUniforms = {
      uTime: { value: 0 },
      uDecay: { value: TUNING.TRAIL_DECAY },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uMouseVel: { value: 0 },
      uStampStrength: { value: TUNING.STAMP_STRENGTH },
      uPointerActive: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPrevTrail: { value: null },
    };

    this.plasmaMaterial = new THREE.ShaderMaterial({
      vertexShader: plasmaVert,
      fragmentShader: plasmaFrag,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
    });

    this.trailMaterial = new THREE.ShaderMaterial({
      vertexShader: trailVert,
      fragmentShader: trailFrag,
      uniforms: this.trailUniforms,
      depthTest: false,
      depthWrite: false,
    });

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.plasmaMaterial);
    this.trailQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.trailMaterial);

    this.trailScene = new THREE.Scene();
    this.trailScene.add(this.trailQuad);

    this.plasmaScene = new THREE.Scene();
    this.plasmaScene.add(this.quad);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.trailTargets = [null, null];
    this._fallbackTexture = null;
  }

  _ensureFallbackTexture() {
    if (this._fallbackTexture) return this._fallbackTexture;

    const data = new Uint8Array([229, 229, 231, 255]);
    this._fallbackTexture = new THREE.DataTexture(data, 1, 1);
    this._fallbackTexture.colorSpace = THREE.SRGBColorSpace;
    this._fallbackTexture.needsUpdate = true;
    return this._fallbackTexture;
  }

  _setIdleBg(hex = '#e5e5e7') {
    const normalized = hex.replace('#', '');
    const r = parseInt(normalized.slice(0, 2), 16) / 255;
    const g = parseInt(normalized.slice(2, 4), 16) / 255;
    const b = parseInt(normalized.slice(4, 6), 16) / 255;
    this.uniforms.uIdleBg.value.set(r, g, b);
  }

  setNoBackground({ idleBg = '#e5e5e7' } = {}) {
    this.uniforms.uBackground.value = this._ensureFallbackTexture();
    this.uniforms.uUseVideo.value = false;
    this.uniforms.uHasBackground.value = false;
    this.uniforms.uBackgroundCover.value.set(1, 1, 0, 0);
    this.trailUniforms.uStampStrength.value = TUNING.STAMP_STRENGTH * 1.26;
    this._setIdleBg(idleBg);
  }

  setBackground(texture, { isVideo = false } = {}) {
    this.uniforms.uBackground.value = texture;
    this.uniforms.uUseVideo.value = isVideo;
    this.uniforms.uHasBackground.value = true;
    this.trailUniforms.uStampStrength.value = TUNING.STAMP_STRENGTH;
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      this.refreshBackgroundCover(texture);
    }
  }

  setSize(width, height) {
    this._viewportWidth = width;
    this._viewportHeight = height;
    this.uniforms.uResolution.value.set(width, height);
    this.trailUniforms.uResolution.value.set(width, height);
    this.refreshBackgroundCover(this.uniforms.uBackground.value);

    const tw = Math.max(1, Math.floor(width * TUNING.TRAIL_SCALE));
    const th = Math.max(1, Math.floor(height * TUNING.TRAIL_SCALE));

    if (!this.trailTargets[0] || this.trailTargets[0].width !== tw || this.trailTargets[0].height !== th) {
      this.trailTargets.forEach((rt) => rt?.dispose());
      this.trailTargets = [
        new THREE.WebGLRenderTarget(tw, th, {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          format: THREE.RGBAFormat,
          type: THREE.FloatType,
        }),
        new THREE.WebGLRenderTarget(tw, th, {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          format: THREE.RGBAFormat,
          type: THREE.FloatType,
        }),
      ];
      this.clearTrail();
    }
  }

  refreshBackgroundCover(texture = this.uniforms.uBackground.value) {
    return setBackgroundCoverUniforms(
      this.uniforms,
      texture,
      this._viewportWidth,
      this._viewportHeight
    );
  }

  clearTrail() {
    if (!this.trailTargets[0]) return;
    const current = this.renderer.getRenderTarget();
    this.trailTargets.forEach((rt) => {
      this.renderer.setRenderTarget(rt);
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.clear();
    });
    this.renderer.setRenderTarget(current);
    this.trailIndex = 0;
    this.uniforms.uTrail.value = this.trailTargets[0].texture;
  }

  updatePointer({ x, y, velocity, isActive }) {
    const vel = Math.min(velocity, 2.5);
    this.uniforms.uMouse.value.set(x, y);
    this.uniforms.uMouseVel.value = vel;
    const active = isActive ? 1 : 0;
    this.uniforms.uPointerActive.value = active;
    this.trailUniforms.uMouse.value.set(x, y);
    this.trailUniforms.uMouseVel.value = isActive ? vel : 0;
    this.trailUniforms.uPointerActive.value = active;
  }

  updateTrail(delta = 1 / 60) {
    if (this.reducedMotion || !this.trailTargets[0]) return;

    const read = this.trailTargets[this.trailIndex];
    const write = this.trailTargets[1 - this.trailIndex];

    this.trailUniforms.uPrevTrail.value = read.texture;
    this.trailUniforms.uDecay.value = Math.pow(TUNING.TRAIL_DECAY, delta * 60);

    const current = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(write);
    this.renderer.render(this.trailScene, this.camera);
    this.renderer.setRenderTarget(current);

    this.trailIndex = 1 - this.trailIndex;
    this.uniforms.uTrail.value = write.texture;
  }

  render() {
    const current = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.plasmaScene, this.camera);
    this.renderer.setRenderTarget(current);
  }

  tick(delta) {
    if (!this.reducedMotion) {
      this.uniforms.uTime.value += delta;
      this.trailUniforms.uTime.value = this.uniforms.uTime.value;
    }
  }

  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
    if (enabled) {
      this.clearTrail();
    }
  }

  dispose() {
    this.plasmaMaterial.dispose();
    this.trailMaterial.dispose();
    this.quad.geometry.dispose();
    this.trailQuad.geometry.dispose();
    this.trailTargets.forEach((rt) => rt?.dispose());
    this._fallbackTexture?.dispose();
  }
}

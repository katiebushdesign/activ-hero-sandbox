export class PointerTracker {
  constructor(element, options = {}) {
    this.element = element;
    this.positionSmoothing = options.positionSmoothing ?? 18;
    this.velocitySmoothing = options.velocitySmoothing ?? 14;
    // Touch hold is often perfectly still; desktop mice jitter enough to widen the bar spread.
    this.holdMinVelocity = options.holdMinVelocity ?? 1.8;

    this.target = { x: 0.5, y: 0.5 };
    this.position = { x: 0.5, y: 0.5 };
    this.velocity = 0;
    this.smoothedVelocity = 0;
    this.isActive = false;
    this._pressed = false;
    this._hovering = false;

    this._last = { x: 0.5, y: 0.5 };
    this._lastTime = performance.now();

    this._isCoarsePointer =
      options.coarsePointer ?? window.matchMedia('(pointer: coarse)').matches;

    this._onMove = this._onMove.bind(this);
    this._onEnter = this._onEnter.bind(this);
    this._onLeave = this._onLeave.bind(this);
    this._onDown = this._onDown.bind(this);
    this._onUp = this._onUp.bind(this);

    const listenerOpts = { passive: true, capture: true };
    element.addEventListener('pointerdown', this._onDown, listenerOpts);
    element.addEventListener('pointermove', this._onMove, listenerOpts);
    element.addEventListener('pointerup', this._onUp, listenerOpts);
    element.addEventListener('pointercancel', this._onUp, listenerOpts);
    element.addEventListener('pointerenter', this._onEnter, listenerOpts);
    element.addEventListener('pointerleave', this._onLeave, listenerOpts);
  }

  _updateFromEvent(event) {
    const rect = this.element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = (event.clientX - rect.left) / rect.width;
    const y = 1.0 - (event.clientY - rect.top) / rect.height;

    const now = performance.now();
    const dt = Math.max((now - this._lastTime) / 1000, 1 / 240);
    const dx = x - this._last.x;
    const dy = y - this._last.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.velocity = dist / dt;
    this.target.x = x;
    this.target.y = y;
    this._last.x = x;
    this._last.y = y;
    this._lastTime = now;
    if (!this._isCoarsePointer) {
      this._hovering = true;
    }
    this.isActive = true;
  }

  _onLeave() {
    if (!this._isCoarsePointer) {
      this._hovering = false;
      this.isActive = false;
    }
  }

  update(delta) {
    const positionMix = 1 - Math.exp(-this.positionSmoothing * delta);
    this.position.x += (this.target.x - this.position.x) * positionMix;
    this.position.y += (this.target.y - this.position.y) * positionMix;

    let targetVelocity = this.isActive ? this.velocity : 0;
    if (this._isCoarsePointer && this._pressed) {
      targetVelocity = Math.max(targetVelocity, this.holdMinVelocity);
    }

    const velocityMix = 1 - Math.exp(-this.velocitySmoothing * delta);
    this.smoothedVelocity += (targetVelocity - this.smoothedVelocity) * velocityMix;

    if (!this.isActive) {
      this.velocity *= Math.pow(0.85, delta * 60);
    }
  }

  _onMove(event) {
    this._updateFromEvent(event);
  }

  _onDown(event) {
    this._pressed = true;
    this._updateFromEvent(event);
  }

  _onUp() {
    this._pressed = false;
    if (this._isCoarsePointer || !this._hovering) {
      this.isActive = false;
    }
  }

  _onEnter(event) {
    if (!this._isCoarsePointer) {
      this._hovering = true;
      this._updateFromEvent(event);
    }
  }

  dispose() {
    const listenerOpts = { capture: true };
    this.element.removeEventListener('pointerdown', this._onDown, listenerOpts);
    this.element.removeEventListener('pointermove', this._onMove, listenerOpts);
    this.element.removeEventListener('pointerup', this._onUp, listenerOpts);
    this.element.removeEventListener('pointercancel', this._onUp, listenerOpts);
    this.element.removeEventListener('pointerenter', this._onEnter, listenerOpts);
    this.element.removeEventListener('pointerleave', this._onLeave, listenerOpts);
  }
}

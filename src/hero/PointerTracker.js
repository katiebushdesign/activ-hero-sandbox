export class PointerTracker {
  constructor(element, options = {}) {
    this.element = element;
    this.positionSmoothing = options.positionSmoothing ?? 14;
    this.velocitySmoothing = options.velocitySmoothing ?? 10;

    this.target = { x: 0.5, y: 0.5 };
    this.position = { x: 0.5, y: 0.5 };
    this.velocity = 0;
    this.smoothedVelocity = 0;
    this.isActive = false;

    this._last = { x: 0.5, y: 0.5 };
    this._lastTime = performance.now();

    this._onMove = this._onMove.bind(this);
    this._onEnter = this._onEnter.bind(this);
    this._onLeave = this._onLeave.bind(this);

    element.addEventListener('pointermove', this._onMove, { passive: true });
    element.addEventListener('pointerenter', this._onEnter, { passive: true });
    element.addEventListener('pointerleave', this._onLeave, { passive: true });
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
    this.isActive = true;
  }

  update(delta) {
    const positionMix = 1 - Math.exp(-this.positionSmoothing * delta);
    this.position.x += (this.target.x - this.position.x) * positionMix;
    this.position.y += (this.target.y - this.position.y) * positionMix;

    const targetVelocity = this.isActive ? this.velocity : 0;
    const velocityMix = 1 - Math.exp(-this.velocitySmoothing * delta);
    this.smoothedVelocity += (targetVelocity - this.smoothedVelocity) * velocityMix;

    if (!this.isActive) {
      this.velocity *= Math.pow(0.85, delta * 60);
    }
  }

  _onMove(event) {
    this._updateFromEvent(event);
  }

  _onEnter(event) {
    this._updateFromEvent(event);
  }

  _onLeave() {
    this.isActive = false;
  }

  dispose() {
    this.element.removeEventListener('pointermove', this._onMove);
    this.element.removeEventListener('pointerenter', this._onEnter);
    this.element.removeEventListener('pointerleave', this._onLeave);
  }
}

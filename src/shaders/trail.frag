precision highp float;

uniform float uTime;
uniform float uDecay;
uniform vec2 uMouse;
uniform float uMouseVel;
uniform float uStampStrength;
uniform float uPointerActive;
uniform vec2 uResolution;
uniform sampler2D uPrevTrail;

varying vec2 vUv;

const float BAND_COUNT = 24.0;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float barVar(float seed) {
  return 0.95 + seed * 0.1;
}

float barPulseScale(float barId, float barSeed) {
  float phase = barId * 0.9 + barSeed * 6.28318;
  float speed = 0.1 + barSeed * 0.12;
  float pulse = sin(uTime * speed + phase);
  return 1.0 + 0.01 + 0.01 * pulse;
}

void main() {
  float prev = texture2D(uPrevTrail, vUv).r * uDecay;

  float barId = floor(vUv.x * BAND_COUNT);
  float mouseBar = uMouse.x * BAND_COUNT;
  float barDist = abs(barId - mouseBar);

  float barSeed = hash(vec2(barId, 3.0));
  float spread = 1.2 + min(uMouseVel, 2.5) * 0.4;
  float columnStamp = uPointerActive * exp(-barDist / (spread * 1.6));
  columnStamp *= barVar(barSeed);

  float pulseScale = barPulseScale(barId, barSeed);
  float yDist = abs(vUv.y - uMouse.y);
  float yRadius = 0.26 * barVar(barSeed) * pulseScale;
  float vertStamp = exp(-yDist * yDist / (yRadius * yRadius));

  float stamp = columnStamp * vertStamp * uStampStrength;
  stamp *= 0.5 + min(uMouseVel, 2.0) * 0.28;

  float vertMask = smoothstep(0.0, 0.06, vUv.y) * (1.0 - smoothstep(0.94, 1.0, vUv.y));

  float trail = clamp(prev + stamp * vertMask, 0.0, 1.0);
  gl_FragColor = vec4(trail, trail, trail, 1.0);
}

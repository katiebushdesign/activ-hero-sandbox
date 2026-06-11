precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uMouseVel;
uniform sampler2D uBackground;
uniform sampler2D uTrail;
uniform float uPlasmaMaskLeft;
uniform float uPixelMax;
uniform float uVelocitySensitivity;
uniform bool uUseVideo;
uniform bool uHasBackground;
uniform vec4 uBackgroundCover; // xy = scale, zw = offset
uniform float uPointerActive;

varying vec2 vUv;

vec2 coverUv(vec2 uv, vec4 cover) {
  return (uv - 0.5) * cover.xy + 0.5 + cover.zw;
}

// Activ palette — Figma nodes 370:697–370:705 (only these colors are sampled)
const int PALETTE_SIZE = 7;
const vec3 PALETTE[PALETTE_SIZE] = vec3[](
  vec3(0.988235, 1.000000, 0.643137), // cream      #FCFFA4
  vec3(0.949020, 0.698039, 0.133333), // gold       #F2B222
  vec3(0.945098, 0.352941, 0.141176), // orange     #F15A24
  vec3(0.764706, 0.235294, 0.329412), // raspberry  #C33C54
  vec3(0.556863, 0.141176, 0.392157), // plum       #8E2464
  vec3(0.254902, 0.000000, 0.400000), // purple     #410066
  vec3(0.000000, 0.000000, 0.000000)  // black      #000000
);

const float BAND_COUNT = 24.0;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 samplePalette(float t) {
  float scaled = clamp(t, 0.0, 1.0) * float(PALETTE_SIZE - 1);
  int idx = int(floor(scaled));
  int nextIdx = min(idx + 1, PALETTE_SIZE - 1);
  float frac = fract(scaled);
  return mix(PALETTE[idx], PALETTE[nextIdx], smoothstep(0.0, 1.0, frac));
}

struct GlassBar {
  float bandId;
  float indexNorm;
  float seedA;
  float seedB;
  float seedC;
};

GlassBar glassBarAt(vec2 uv) {
  float scaled = uv.x * BAND_COUNT;
  GlassBar bar;
  bar.bandId = floor(scaled);
  bar.indexNorm = (bar.bandId + fract(scaled)) / BAND_COUNT;
  bar.seedA = hash(vec2(bar.bandId, 0.0));
  bar.seedB = hash(vec2(bar.bandId, 1.0));
  bar.seedC = hash(vec2(bar.bandId, 2.0));
  return bar;
}

vec3 sampleBackground(vec2 uv) {
  if (!uHasBackground) {
    return vec3(0.02, 0.02, 0.04);
  }

  vec2 bgUv = clamp(coverUv(uv, uBackgroundCover), 0.0, 1.0);
  vec4 bg = texture2D(uBackground, bgUv);

  if (!uUseVideo && bg.a < 0.01 && length(bg.rgb) < 0.01) {
    bg.rgb = vec3(0.02, 0.02, 0.04);
  }

  return bg.rgb;
}

float filmGrain(vec2 uv) {
  vec2 cell = floor(uv * uResolution * 0.45);
  float t = uTime * 0.06;
  float g1 = hash(cell + t);
  float g2 = hash(cell * 1.37 + t * 0.73);
  return (g1 + g2) * 0.5 - 0.5;
}

float barVar(float seed) {
  return 0.95 + seed * 0.1;
}

float barPulseScale(GlassBar bar) {
  float phase = bar.bandId * 0.9 + bar.seedB * 6.28318;
  float speed = 0.1 + bar.seedC * 0.12;
  float pulse = sin(uTime * speed + phase);
  return 1.0 + 0.01 + 0.01 * pulse;
}

vec3 figmaGradient(vec2 uv, GlassBar bar, float emit) {
  float barYOffset = (bar.seedA - 0.5) * 0.08;

  float paletteT = (1.0 - uv.y) + barYOffset;

  float grain = hash(floor(uv * uResolution * 0.3));
  paletteT += (grain - 0.5) * 0.016 * emit;

  paletteT = clamp(paletteT, 0.0, 1.0);
  return samplePalette(paletteT);
}

void main() {
  vec2 uv = vUv;
  vec2 mouseUv = uMouse;

  float verticalMask = smoothstep(0.0, 0.08, uv.y) * (1.0 - smoothstep(0.9, 1.0, uv.y));

  GlassBar bar = glassBarAt(uv);

  float trailSample = texture2D(uTrail, uv).r;

  float barCenter = (bar.bandId + 0.5) / BAND_COUNT;
  float columnDist = abs(barCenter - mouseUv.x);

  float barStrength = barVar(bar.seedC);
  float diffuseRate = 0.5 * barVar(bar.seedA);
  float diffuseOffset = 0.08 * (bar.seedB - 0.5);

  float liveColumn = uPointerActive * exp(-columnDist / 0.055);
  float activation = max(trailSample, liveColumn * 0.4);

  float barReveal = smoothstep(diffuseOffset, diffuseOffset + diffuseRate, activation);
  barReveal = pow(barReveal, barVar(bar.seedA));

  float pulseScale = barPulseScale(bar);
  float emitRadius = 0.26 * barVar(bar.seedB) * pulseScale;

  float yDist = abs(uv.y - mouseUv.y);
  float liveEmit = uPointerActive * exp(-yDist * yDist / (emitRadius * emitRadius));

  float emit = max(trailSample, liveEmit * liveColumn);
  emit *= barStrength;

  vec3 gradColor = figmaGradient(uv, bar, emit);

  vec3 color = sampleBackground(uv);

  float idleTint = verticalMask * barVar(bar.seedA) * (uHasBackground ? 0.42 : 0.22);
  if (uHasBackground) {
    color = mix(color, color * 0.65, idleTint);
  } else {
    vec3 idleHint = figmaGradient(uv, bar, 0.12);
    color = mix(color, idleHint, idleTint);
  }

  float grain = filmGrain(uv);
  color += grain * 0.06;

  float colorAlpha = verticalMask * barReveal * emit;
  if (colorAlpha > 0.001) {
    vec3 screened = 1.0 - (1.0 - color) * (1.0 - gradColor);
    color = mix(color, screened, colorAlpha * 0.92);
    color += grain * 0.05 * colorAlpha;
  }

  float vignette = smoothstep(1.15, 0.3, length((uv - 0.5) * vec2(1.05, 1.0)));
  color *= mix(0.78, 1.0, vignette);

  gl_FragColor = vec4(color, 1.0);
}

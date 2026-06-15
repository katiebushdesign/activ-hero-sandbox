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
uniform vec3 uIdleBg;
uniform float uBackgroundGrade;

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
    return uIdleBg;
  }

  vec2 bgUv = clamp(coverUv(uv, uBackgroundCover), 0.0, 1.0);
  vec4 bg = texture2D(uBackground, bgUv);

  if (!uUseVideo && bg.a < 0.01 && length(bg.rgb) < 0.01) {
    bg.rgb = vec3(0.02, 0.02, 0.04);
  }

  return bg.rgb;
}

float filmGrain(vec2 uv) {
  float scale = uHasBackground ? 0.45 : 0.62;
  vec2 cell = floor(uv * uResolution * scale);
  float t = uTime * 0.06;
  float g1 = hash(cell + t);
  float g2 = hash(cell * 1.37 + t * 0.73);
  float g3 = hash(cell * 2.11 + t * 0.41);
  return (g1 + g2 + g3) / 3.0 - 0.5;
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

vec3 saturateColor(vec3 color, float amount) {
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  return mix(vec3(luma), color, amount);
}

vec3 figmaGradient(vec2 uv, GlassBar bar, float emit) {
  float barYOffset = (bar.seedA - 0.5) * 0.08;

  float paletteT = (1.0 - uv.y) + barYOffset;

  if (!uHasBackground) {
    paletteT = paletteT * 0.83 + 0.095;
  }

  float grain = hash(floor(uv * uResolution * 0.3));
  float fineGrain = hash(floor(uv * uResolution * 0.9) + 0.37);
  float grainStrength = uHasBackground ? 0.022 : 0.048;
  paletteT += ((grain - 0.5) * grainStrength + (fineGrain - 0.5) * grainStrength * 0.55) * emit;

  paletteT = clamp(paletteT, 0.0, 1.0);
  vec3 grad = samplePalette(paletteT);

  if (!uHasBackground) {
    grad = saturateColor(grad, 1.2);
  }

  return grad;
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

  float liveColumn = uPointerActive * exp(-columnDist / 0.038);
  float liveColumnWeight = uHasBackground ? 0.4 : 0.53;
  float activation = max(trailSample, liveColumn * liveColumnWeight);

  float barReveal = smoothstep(diffuseOffset, diffuseOffset + diffuseRate, activation);
  barReveal = pow(barReveal, barVar(bar.seedA));

  float pulseScale = barPulseScale(bar);
  float emitRadius = 0.22 * barVar(bar.seedB) * pulseScale;

  float yDist = abs(uv.y - mouseUv.y);
  float liveEmit = uPointerActive * exp(-yDist * yDist / (emitRadius * emitRadius));

  float emit = max(trailSample, liveEmit * liveColumn);
  emit *= barStrength;

  float colorAlpha = verticalMask * barReveal * emit;

  vec3 gradColor = figmaGradient(uv, bar, emit);

  // Overlay: HTML image/video below canvas — plasma only, full-brightness media underneath.
  if (uBackgroundGrade < 0.001) {
    if (colorAlpha < 0.001) {
      discard;
    }
    float grain = filmGrain(uv);
    vec3 color = gradColor + grain * 0.12 * colorAlpha;
    gl_FragColor = vec4(color, clamp(colorAlpha * 0.92, 0.0, 1.0));
    return;
  }

  if (!uHasBackground && colorAlpha < 0.001) {
    gl_FragColor = vec4(uIdleBg, 1.0);
    return;
  }

  vec3 color = sampleBackground(uv);

  if (uHasBackground && uBackgroundGrade > 0.001) {
    float idleTint = verticalMask * 0.42 * barVar(bar.seedA);
    color = mix(color, color * 0.65, idleTint * uBackgroundGrade);
  }

  float grain = filmGrain(uv);

  if (uHasBackground && uBackgroundGrade > 0.001) {
    color += grain * 0.075;
  }

  if (colorAlpha > 0.001) {
    if (uHasBackground) {
      vec3 screened = 1.0 - (1.0 - color) * (1.0 - gradColor);
      color = mix(color, screened, colorAlpha * 0.92);
      if (uBackgroundGrade > 0.001) {
        color += grain * 0.085 * colorAlpha;
      }
    } else {
      float blend = clamp(colorAlpha * 1.15, 0.0, 1.0);
      vec3 toned = mix(gradColor, uIdleBg, 0.15);
      color = mix(color, toned, blend * 0.86);
      color += grain * 0.12 * colorAlpha;
    }
  }

  if (uHasBackground && uBackgroundGrade > 0.001) {
    float vignette = smoothstep(1.15, 0.3, length((uv - 0.5) * vec2(1.05, 1.0)));
    color *= mix(0.78, 1.0, mix(1.0, vignette, uBackgroundGrade));
  }

  gl_FragColor = vec4(color, 1.0);
}

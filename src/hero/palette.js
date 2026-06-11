/** Activ Surgical brand palette (Figma nodes 370:697–370:705) */

export const ACTIV_PALETTE = [
  { name: 'cream', hex: '#FCFFA4' },
  { name: 'gold', hex: '#F2B222' },
  { name: 'orange', hex: '#F15A24' },
  { name: 'raspberry', hex: '#C33C54' },
  { name: 'plum', hex: '#8E2464' },
  { name: 'purple', hex: '#410066' },
  { name: 'black', hex: '#000000' },
];

/** Lighter stops used during mouse disruption */
export const DISRUPTION_PALETTE = [
  { name: 'cream', hex: '#FCFFA4' },
  { name: 'gold', hex: '#F2B222' },
  { name: 'orange', hex: '#F15A24' },
  { name: 'raspberry', hex: '#C33C54' },
];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToVec3([r, g, b]) {
  return [r / 255, g / 255, b / 255];
}

export function paletteToVec3Array(palette) {
  return palette.map(({ hex }) => rgbToVec3(hexToRgb(hex)));
}

export function paletteToGlslVec3(palette) {
  const stops = paletteToVec3Array(palette);
  return stops
    .map(([r, g, b], i) => `vec3(${r.toFixed(6)}, ${g.toFixed(6)}, ${b.toFixed(6)}) /* ${palette[i].name} */`)
    .join(',\n  ');
}

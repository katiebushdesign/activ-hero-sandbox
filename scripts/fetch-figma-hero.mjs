/**
 * Export hero assets from Figma.
 *
 * Usage:
 *   FIGMA_ACCESS_TOKEN=xxx npm run fetch-hero
 *
 * Or add public/assets to Figma Dev Mode → MCP → Allowed directories
 * and re-run the Figma MCP export.
 */

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE_KEY = 'aKVxgavTNV0x4lauDGG1Ub';
const ASSETS = [
  { nodeId: '370:694', format: 'jpg', scale: 2, outFile: 'hero-figma.jpg' },
  { nodeId: '448:1319', format: 'svg', outFile: 'activ-logo.svg' },
  { nodeId: '448:1374', format: 'svg', outFile: 'scroll-arrow.svg' },
];

const root = join(dirname(fileURLToPath(import.meta.url)), '../public/assets');
const token = process.env.FIGMA_ACCESS_TOKEN || process.env.FIGMA_TOKEN;

if (!token) {
  console.error('Set FIGMA_ACCESS_TOKEN to export Figma assets.');
  process.exit(1);
}

for (const asset of ASSETS) {
  const params = new URLSearchParams({
    ids: asset.nodeId,
    format: asset.format,
  });
  if (asset.scale) params.set('scale', String(asset.scale));

  const imagesRes = await fetch(
    `https://api.figma.com/v1/images/${FILE_KEY}?${params}`,
    { headers: { 'X-Figma-Token': token } }
  );

  if (!imagesRes.ok) {
    console.error('Figma images API failed:', asset.nodeId, imagesRes.status, await imagesRes.text());
    process.exit(1);
  }

  const { images, err } = await imagesRes.json();
  if (err) {
    console.error('Figma error:', err);
    process.exit(1);
  }

  const imageUrl = images[asset.nodeId];
  if (!imageUrl) {
    console.error('No image URL returned for node', asset.nodeId);
    process.exit(1);
  }

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    console.error('Image download failed:', asset.nodeId, imageRes.status);
    process.exit(1);
  }

  const buffer = Buffer.from(await imageRes.arrayBuffer());
  const outPath = join(root, asset.outFile);
  await writeFile(outPath, buffer);
  console.log('Saved', outPath);
}

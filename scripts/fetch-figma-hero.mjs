/**
 * Export hero background from Figma node 370:694.
 *
 * Usage:
 *   FIGMA_ACCESS_TOKEN=xxx npm run fetch-hero
 *
 * Or add public/assets to Figma Dev Mode → MCP → Allowed directories
 * and re-run the Figma MCP export for node 370:694.
 */

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE_KEY = 'aKVxgavTNV0x4lauDGG1Ub';
const NODE_ID = '370:694';
const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), '../public/assets/hero-figma.jpg');

const token = process.env.FIGMA_ACCESS_TOKEN || process.env.FIGMA_TOKEN;

if (!token) {
  console.error('Set FIGMA_ACCESS_TOKEN to export the exact Figma image.');
  process.exit(1);
}

const imagesRes = await fetch(
  `https://api.figma.com/v1/images/${FILE_KEY}?ids=${encodeURIComponent(NODE_ID)}&format=jpg&scale=2`,
  { headers: { 'X-Figma-Token': token } }
);

if (!imagesRes.ok) {
  console.error('Figma images API failed:', imagesRes.status, await imagesRes.text());
  process.exit(1);
}

const { images, err } = await imagesRes.json();
if (err) {
  console.error('Figma error:', err);
  process.exit(1);
}

const imageUrl = images[NODE_ID];
if (!imageUrl) {
  console.error('No image URL returned for node', NODE_ID);
  process.exit(1);
}

const imageRes = await fetch(imageUrl);
if (!imageRes.ok) {
  console.error('Image download failed:', imageRes.status);
  process.exit(1);
}

const buffer = Buffer.from(await imageRes.arrayBuffer());
await writeFile(OUT_PATH, buffer);
console.log('Saved', OUT_PATH);

// Génère les icônes PNG de la PWA à partir de public/favicon.svg.
// Usage : npm run icons
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url));
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname;

await sharp(svg, { density: 300 }).resize(192, 192).png().toFile(out('pwa-192.png'));
await sharp(svg, { density: 300 }).resize(512, 512).png().toFile(out('pwa-512.png'));
// iOS arrondit lui-même les coins : fond plein, sans transparence.
await sharp(svg, { density: 300 })
  .resize(180, 180)
  .flatten({ background: '#1d6b4f' })
  .png()
  .toFile(out('apple-touch-icon.png'));
console.log('Icônes générées.');

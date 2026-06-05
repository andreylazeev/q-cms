/**
 * Generate demo cover images for the admin media library.
 *
 * Each image is a 960×540 SVG with a layered gradient + simple
 * landscape silhouette so the screenshots look populated, not
 * placeholders. Outputs to `apps/admin/public/media/`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'apps', 'admin', 'public', 'media');
mkdirSync(OUT_DIR, { recursive: true });

/** @type {Array<{id: string, name: string, sky: [string, string], mountain: string, ground: string, sun?: string}>} */
const IMAGES = [
  { id: 'm_hero',    name: 'hero-mountain.jpg',    sky: ['#1f3a5f', '#7c8d9e'], mountain: '#2c3e50', ground: '#4a6076', sun: '#f4d35e' },
  { id: 'm_cover1',  name: 'aurora-borealis.jpg',  sky: ['#0a192f', '#1e3a8a'], mountain: '#0a192f', ground: '#0a3050', sun: '#5eead4' },
  { id: 'm_cover2',  name: 'forest-trail.jpg',     sky: ['#7a9d96', '#cfd9c7'], mountain: '#2d5a2d', ground: '#1a3a1a' },
  { id: 'm_cover3',  name: 'desert-dunes.jpg',     sky: ['#f4d8a4', '#c2956b'], mountain: '#a8754a', ground: '#8a5a35' },
  { id: 'm_cover4',  name: 'city-night.jpg',       sky: ['#1f1f3a', '#3b3b6d'], mountain: '#2a2a4a', ground: '#1a1a30' },
  { id: 'm_cover5',  name: 'ocean-cliffs.jpg',     sky: ['#a8d8e8', '#5fa8c4'], mountain: '#3a6b8a', ground: '#1f4a6a' },
  { id: 'm_cover6',  name: 'aut-forest.jpg',       sky: ['#f4a261', '#a85d2b'], mountain: '#5a3a1f', ground: '#3a2a1a' },
];

for (const img of IMAGES) {
  const [skyTop, skyBot] = img.sky;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="960" height="540">
  <defs>
    <linearGradient id="sky-${img.id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyTop}"/>
      <stop offset="100%" stop-color="${skyBot}"/>
    </linearGradient>
    <linearGradient id="ground-${img.id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${img.mountain}"/>
      <stop offset="100%" stop-color="${img.ground}"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#sky-${img.id})"/>
  ${img.sun ? `<circle cx="${100 + Math.floor(Math.random() * 760)}" cy="160" r="48" fill="${img.sun}" opacity="0.85"/>` : ''}
  <!-- back mountain -->
  <polygon points="0,360 160,260 280,300 420,220 560,290 720,240 880,300 960,280 960,540 0,540" fill="${img.mountain}" opacity="0.7"/>
  <!-- front mountain -->
  <polygon points="0,420 120,340 260,400 400,330 540,410 700,350 840,400 960,380 960,540 0,540" fill="url(#ground-${img.id})"/>
  <!-- foreground silhouettes -->
  <path d="M 0 460 Q 240 440 480 460 T 960 460 L 960 540 L 0 540 Z" fill="${img.ground}" opacity="0.85"/>
</svg>
`;
  writeFileSync(resolve(OUT_DIR, `${img.id}.svg`), svg);
  console.log(`  ✓ ${img.id}.svg`);
}

const AVATARS = [
  { id: 'm_avatar1', color: '#d4a574', initials: 'SV' },
  { id: 'm_avatar2', color: '#7a9d96', initials: 'MC' },
  { id: 'm_avatar3', color: '#b07a7a', initials: 'AL' },
];

for (const a of AVATARS) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="g-${a.id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a.color}"/>
      <stop offset="100%" stop-color="${shade(a.color, -30)}"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" fill="url(#g-${a.id})"/>
  <text x="128" y="158" font-family="ui-sans-serif, system-ui, -apple-system" font-size="96" font-weight="600" fill="white" text-anchor="middle" opacity="0.92">${a.initials}</text>
</svg>
`;
  writeFileSync(resolve(OUT_DIR, `${a.id}.svg`), svg);
  console.log(`  ✓ ${a.id}.svg`);
}

console.log(`Done. ${IMAGES.length + AVATARS.length} demo images written to ${OUT_DIR}`);

function shade(hex, percent) {
  const num = Number.parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const adjust = (c) => {
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent) / 100;
    return Math.round((t - c) * p) + c;
  };
  const toHex = (c) => c.toString(16).padStart(2, '0');
  return `#${toHex(adjust(r))}${toHex(adjust(g))}${toHex(adjust(b))}`;
}

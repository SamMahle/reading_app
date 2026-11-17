/**
 * Renders the PWA icons from public/icons/icon.svg (the placeholder book
 * icon, spec §15). Run after changing the SVG: `node scripts/make-icons.mjs`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const dir = resolve(import.meta.dirname, '..', 'public', 'icons');
const svg = readFileSync(resolve(dir, 'icon.svg'), 'utf8');
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
  // Maskable icons keep their artwork inside the central safe zone.
  { file: 'icon-maskable-512.png', size: 512, pad: 0.1 },
];

const browser = await chromium.launch();
for (const { file, size, pad } of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(
    `<body style="margin:0;background:#f6f3ec;display:grid;place-items:center;height:100vh"><div style="width:${inner}px;height:${inner}px">${svg}</div></body>`,
  );
  await page.screenshot({ path: resolve(dir, file) });
  await page.close();
  console.log(`wrote ${file}`);
}
await browser.close();

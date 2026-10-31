// Phone-size screenshots of the main screens, for a quick visual check before a release.
//   node scripts/shots.mjs https://<site> <out-dir> [light|dark]
// Writes <name>.png per screen; "-full" ones are the whole page so you can count screens.
import { mkdirSync } from 'node:fs';
import { launchEdge } from './edge.mjs';

const [, , base, out = 'shots', theme = 'light'] = process.argv;
if (!base) {
  console.error('usage: node scripts/shots.mjs <site-url> [out-dir] [light|dark]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const SHOTS = [
  ['landing-fold', '/', false],
  ['landing-full', '/', true],
  ['check', '/check', false],
  ['item-fold', '/item/auto-station-to-centre', false],
  ['item-full', '/item/auto-station-to-centre', true],
  ['feed', '/feed', false],
  ['me', '/me', false],
];

const browser = await launchEdge();
const page = (await browser.pages())[0];
await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
const settle = (ms = 1200) => new Promise((r) => setTimeout(r, ms));

for (const [name, url, full] of SHOTS) {
  await page.goto(base + url, { waitUntil: 'networkidle2', timeout: 60000 });
  await settle();
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(name.padEnd(14), full ? `${height} px, ${(height / 812).toFixed(1)} screens` : '');
}

// the sign-in sheet, as a signed-out visitor sees it from the share button
await page.goto(base + '/check', { waitUntil: 'networkidle2' });
await settle(800);
const fab = await page.$('button[aria-label="Share a price"]');
if (fab) {
  await fab.click();
  await settle(900);
  await page.screenshot({ path: `${out}/signin-sheet.png` });
  console.log('signin-sheet');
}
await browser.close();

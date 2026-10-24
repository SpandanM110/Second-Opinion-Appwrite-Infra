// Automated accessibility audit (axe-core, WCAG 2.1 A/AA + best practices) across every screen and the open sheets.
//   node scripts/a11y.mjs http://localhost:4177
import fs from 'node:fs';
import { launchEdge } from './edge.mjs';

const base = process.argv[2] ?? 'http://localhost:4177';
const axeSource = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const PAGES = [
  ['landing', '/about'],
  ['check', '/check'],
  ['card', '/item/auto-station-to-centre?c=bhopal&l=bpl-rani-kamlapati-station'],
  ['card (no data)', '/item/painter-per-day?c=mumbai&l=bom-colaba'],
  ['compare', '/compare/mens-haircut?a=bhopal&b=mumbai'],
  ['feed', '/feed'],
  ['question', '/q/seed-qc-01'],
  ['profile', '/u/seed-u01'],
  ['me (signed out)', '/me'],
  ['api', '/api'],
  ['404', '/nope'],
];

const browser = await launchEdge();
let total = 0;
const report = [];

async function audit(page, label) {
  await page.evaluate(axeSource);
  const result = await page.evaluate(async () =>
    // eslint-disable-next-line no-undef
    axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] }),
  );
  for (const v of result.violations) {
    total += v.nodes.length;
    report.push({ label, id: v.id, impact: v.impact, help: v.help, count: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') + ' :: ' + (v.nodes[0]?.failureSummary ?? '').split('\n').slice(0, 2).join(' ').slice(0, 220) });
  }
}

for (const width of [375, 1280]) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: width < 700 ? 812 : 900, isMobile: width < 700, hasTouch: width < 700 });
  for (const [name, url] of PAGES) {
    await page.goto(base + url, { waitUntil: 'networkidle0', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 600));
    await audit(page, `${name} @${width}`);
  }
  // open sheets
  await page.goto(base + '/check', { waitUntil: 'networkidle0' });
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Share a price/.test(b.textContent ?? ''))?.click());
  await page.waitForSelector('dialog[open]');
  await new Promise((r) => setTimeout(r, 400));
  await audit(page, `account sheet @${width}`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Choose your area/.test(b.textContent ?? ''))?.click());
  await page.waitForSelector('dialog[open]');
  await new Promise((r) => setTimeout(r, 400));
  await audit(page, `area picker @${width}`);
  await page.close();
}
await browser.close();

const grouped = new Map();
for (const r of report) {
  const g = grouped.get(r.id) ?? { ...r, pages: [] };
  g.pages.push(`${r.label} (${r.count})`);
  grouped.set(r.id, g);
}
console.log(`${total} violation nodes across ${PAGES.length * 2 + 4} audited views, ${grouped.size} distinct rules\n`);
for (const g of [...grouped.values()].sort((a, b) => ['critical', 'serious', 'moderate', 'minor'].indexOf(a.impact) - ['critical', 'serious', 'moderate', 'minor'].indexOf(b.impact))) {
  console.log(`[${g.impact}] ${g.id}: ${g.help}\n   on: ${g.pages.slice(0, 6).join('; ')}${g.pages.length > 6 ? ` +${g.pages.length - 6} more` : ''}\n   e.g. ${g.sample}\n`);
}
process.exit(0);

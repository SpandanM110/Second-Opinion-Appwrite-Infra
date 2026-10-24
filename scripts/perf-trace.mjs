// Request waterfall for one page under Fast 3G + 4x CPU slowdown: where does the time go?
//   node scripts/perf-trace.mjs https://<site> "/item/auto-station-to-centre?c=bhopal&l=bpl-rani-kamlapati-station"
import { launchEdge } from './edge.mjs';

const [, , base, url = '/'] = process.argv;
const browser = await launchEdge();
const page = (await browser.pages())[0];
await page.bringToFront();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const cdp = await page.createCDPSession();
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

const reqs = new Map();
const t0 = Date.now();
cdp.on('Network.requestWillBeSent', (e) => reqs.set(e.requestId, { url: e.request.url, start: Date.now() - t0, type: e.type }));
cdp.on('Network.responseReceived', (e) => Object.assign(reqs.get(e.requestId) ?? {}, { ttfb: Date.now() - t0, status: e.response.status }));
cdp.on('Network.loadingFinished', (e) => Object.assign(reqs.get(e.requestId) ?? {}, { end: Date.now() - t0, bytes: e.encodedDataLength }));
await page.evaluateOnNewDocument(() => {
  window.__marks = {};
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__marks[e.name || e.entryType] = Math.round(e.startTime);
  }).observe({ type: 'paint', buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__marks.lcp = Math.round(e.startTime);
  }).observe({ type: 'largest-contentful-paint', buffered: true });
});
await page.goto(base + url, { waitUntil: 'load', timeout: 120000 });
await new Promise((r) => setTimeout(r, 3000));
const marks = await page.evaluate(() => window.__marks);
console.log('paint marks (ms):', JSON.stringify(marks));
const rows = [...reqs.values()].filter((r) => r.end).sort((a, b) => a.start - b.start);
console.log('start→end (ms)   size   type      url');
for (const r of rows) {
  const short = r.url.replace(base, '').replace(/^https?:\/\//, '').slice(0, 78);
  console.log(`${String(r.start).padStart(5)}→${String(r.end).padEnd(5)}  ${(r.bytes / 1024).toFixed(0).padStart(4)}KB  ${String(r.type).padEnd(9)} ${short}`);
}
await browser.close();
process.exit(0);

// Page-load measurements under a throttled phone connection (the plan: "first card under 2 s on 3G").
//   node scripts/perf.mjs https://<site>
// Network: Fast 3G (1.6 Mbps down, 750 Kbps up, 150 ms RTT) and a 4x slower CPU, cold cache, three runs per page (median).
import { launchEdge } from './edge.mjs';

const base = process.argv[2];
const PAGES = [
  ['landing', '/about'],
  ['check', '/check'],
  ['card', '/item/auto-station-to-centre?c=bhopal&l=bpl-rani-kamlapati-station'],
  ['feed', '/feed'],
];
const PROFILES = {
  'Fast 3G': { latency: 150, down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8 },
  'Slow 3G': { latency: 400, down: (400 * 1024) / 8, up: (400 * 1024) / 8 },
};

const browser = await launchEdge();
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

for (const [profileName, net] of Object.entries(PROFILES)) {
  console.log(`\n== ${profileName}, 4x CPU slowdown, cold cache`);
  console.log('page'.padEnd(10), 'FCP'.padStart(7), 'LCP'.padStart(7), 'loaded'.padStart(8), 'JS (gz)'.padStart(9), 'total'.padStart(9), ' requests');
  for (const [name, url] of PAGES) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      // the tab Edge opened with is the foreground one; a tab opened later can start in the background, where painting is deferred
      const page = (await browser.pages())[0];
      await page.goto('about:blank');
      await page.bringToFront();
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      const cdp = await page.createCDPSession();
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: net.latency, downloadThroughput: net.down, uploadThroughput: net.up });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      let bytes = 0;
      let js = 0;
      let reqs = 0;
      const types = new Map();
      cdp.on('Network.responseReceived', (e) => types.set(e.requestId, e.type));
      cdp.on('Network.loadingFinished', (e) => {
        bytes += e.encodedDataLength;
        reqs++;
        if (types.get(e.requestId) === 'Script') js += e.encodedDataLength;
      });
      await page.evaluateOnNewDocument(() => {
        window.__lcp = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) window.__lcp = e.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      const t0 = Date.now();
      await page.goto(base + url, { waitUntil: 'load', timeout: 120000 });
      const loaded = Date.now() - t0;
      await new Promise((r) => setTimeout(r, 1500));
      const m = await page.evaluate(() => ({ fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0, lcp: window.__lcp }));
      runs.push({ ...m, loaded, bytes, js, reqs });
      await cdp.detach();
    }
    const med = (k) => median(runs.map((r) => r[k]));
    console.log(
      name.padEnd(10),
      `${(med('fcp') / 1000).toFixed(1)}s`.padStart(7),
      `${(med('lcp') / 1000).toFixed(1)}s`.padStart(7),
      `${(med('loaded') / 1000).toFixed(1)}s`.padStart(8),
      `${(med('js') / 1024).toFixed(0)} KB`.padStart(9),
      `${(med('bytes') / 1024).toFixed(0)} KB`.padStart(9),
      `  ${med('reqs')}`,
    );
  }
}
await browser.close();
process.exit(0);

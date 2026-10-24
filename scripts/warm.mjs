// Warms the live site and API after a deploy: server containers start cold, so the first requests to each
// route are slow for a few minutes. Run this before a demo, a recording or a test.
//   npm run warm            (uses the production URLs)
const SITE = process.env.SITE_URL ?? 'https://6adcc60d0036a5cd4f5c.appwrite.network';
const API = process.env.API_URL ?? 'https://6adcba4a001b8bfea9d0.appwrite.network';
const paths = ['/', '/about', '/check', '/feed', '/compare', '/me', '/api', '/reset', '/og',
  '/item/auto-station-to-centre?c=bhopal&l=bpl-rani-kamlapati-station', '/item/plumber-visit?c=bhopal', '/item/chai?c=indore', '/compare/mens-haircut?a=bhopal&b=mumbai', '/q/seed-qc-01', '/u/seed-u01'];
const t0 = Date.now();
let slow = 0;
for (let round = 1; round <= 3; round++) {
  const times = await Promise.all(
    paths.map(async (p) => {
      const s = Date.now();
      const r = await fetch(SITE + p, { redirect: 'manual' }).catch(() => null);
      await r?.arrayBuffer().catch(() => {});
      return Date.now() - s;
    }),
  );
  const s = Date.now();
  await fetch(`${API}/?item=auto-station-to-centre&locality=bpl-rani-kamlapati-station`).then((r) => r.arrayBuffer()).catch(() => {});
  const api = Date.now() - s;
  slow = times.filter((t) => t > 1500).length + (api > 1500 ? 1 : 0);
  console.log(`round ${round}: pages median ${[...times].sort((a, b) => a - b)[Math.floor(times.length / 2)]} ms, slowest ${Math.max(...times)} ms, api ${api} ms, ${slow} slow`);
}
console.log(`${slow === 0 ? 'warm' : 'still warming'} after ${((Date.now() - t0) / 1000).toFixed(0)} s`);

# Second Opinion

**Know the fair price before you pay.** Second Opinion is a verified, locality-level price layer for everything that isn't on an app: auto rides, plumbers, haircuts, street food. Locals share what they actually paid, newcomers check the fair range before they negotiate, and the community confirms or flags each other's numbers.

Built solo for the **Appwrite Databases Hackathon**, on **Appwrite TablesDB**. Development started on October 24, 2026 (after the October 19 start of the hackathon).

|  |  |
| --- | --- |
| **Live app** | https://6adcc60d0036a5cd4f5c.appwrite.network |
| **Public API** | https://6adcba4a001b8bfea9d0.appwrite.network/?item=auto-station-to-centre&locality=bpl-rani-kamlapati-station (reference and live try-it at `/api` in the app) |
| **Version log** | [docs/gap-analysis.md](docs/gap-analysis.md): every release measured against the plan's acceptance criteria |

```bash
curl "https://6adcba4a001b8bfea9d0.appwrite.network/?item=auto-station-to-centre&locality=bpl-rani-kamlapati-station"
# → ₹105, most people paid ₹99–115, high confidence, 26 prices from 17 people,
#   "first quotes here average 2.6x the fair price"
```

## Why an LLM can't answer this

An assistant with an Uber or Maps MCP can quote a cab fare, because a company already built that database. The auto outside the station, the plumber your neighbour recommends, the barber, the chaiwala: no platform, no database, nothing to retrieve. Second Opinion is the thing that writes it down, with three properties a model can't supply on its own:

| | A model gives | Second Opinion gives |
| --- | --- | --- |
| Granularity | A city-level ballpark, often years old | A locality-level range from the last 90 days |
| Provenance | One number, no sample behind it | Median, typical range, N prices from M people, a confidence badge |
| Verification | No way for a local to correct it | Confirmations, flags and reputation weighting; the range self-corrects |

And because the fair range is an API, the next assistant can ask Second Opinion directly (an MCP server is on the roadmap).

## What you can do

| | |
| --- | --- |
| **Check** (no account) | Search an item (English or Hindi names), see the fair price for your area, how far to trust it, what to offer, settle at and walk away above, and whether a quote you got is fair |
| **Compare** | The same item in two cities, side by side with the ratio, or every item at once |
| **Share a price** | Pick the item and area (GPS-aware), type the amount, optionally attach a receipt photo. Saved drafts, sanity checks that name the unit, an offline queue |
| **Verify** | One tap to confirm a price you've paid too; flag one that looks wrong, with a reason. Three flags from different people hide a price |
| **Ask locals** | "Is ₹300 fair?" goes out with the current fair price attached; answers arrive live; the asker marks the helpful one |
| **Earn standing** | Newcomer → Regular → Trusted local, with a visible journey on your profile |

## How it works

```mermaid
flowchart LR
  B[Browser<br/>Next.js on Sites]
  W[worker Function<br/>verified writes + stats]
  F[fair-range Function<br/>public read API]
  DB[(TablesDB<br/>11 tables)]
  S[(Storage<br/>receipts)]
  R{{Realtime}}

  B -- "sign in (Auth)" --> A[Appwrite Auth]
  B -- "upload receipt" --> S
  B -- "log · confirm · flag · ask · reply" --> W
  W -- "validates, writes as the caller" --> DB
  W -- "starts recompute" --> W
  W -- "weights → percentiles → confidence" --> PS[price_stats]
  B -- "reads price_stats, prices, questions" --> DB
  PS --- DB
  DB -- "reply events" --> R --> B
  X[Any app or assistant] -- "GET /?item=…" --> F --> DB
```

- **Clients read; one Function writes.** Table permissions let anyone read and nobody write. Every write goes through the `worker` Function, which learns the caller from Appwrite (never from the request body), validates the input again, limits each person to 20 prices a day, verifies receipts belong to the caller, and then writes with its own key. Nobody can post as a trusted local, forge a timestamp or inflate a counter.
- **No single price is trusted.** Each price is weighted by its author's standing × recency (`e^(-days/45)`) × 0.5 for new accounts × 2 with a receipt, plus 0.5 per same-city confirmation. The card shows the weighted median and the p25–p75 band. Only `paid` and `listed` prices feed the fair price; `quoted` prices feed the overcharge index.
- **Every number says how local and how sure it is.** The card prefers the locality and falls back to city, then state, when local data is thin. A fallback is labelled and capped at Medium confidence.
- **Overcharge index:** median first quote ÷ median paid price in a locality. At Rani Kamlapati (Habibganj) station it is about 2.6x; in residential Arera Colony about 1.2x.
- **Hiding is reversible and explained.** The third flag hides a price immediately, and the author sees why, so honest mistakes (wrong unit) can be shared again correctly.
- **Standing is recomputed from scratch** on every run (+0.1 per confirmation, −0.3 per flag), so it can't drift or be tampered with.
- **No vendor names, ever.** Prices belong to an item and an area, never a shop or a person.

## Appwrite usage

| Service | Used for |
| --- | --- |
| **TablesDB** | 11 tables, 88 columns and 17 indexes, including unique composite indexes that enforce one confirmation and one flag per person per price. Read-only permissions for clients; bulk `createRows` / `upsertRows` / `deleteRows`; deterministic row ids make every write idempotent |
| **Auth** | Email and password. Sessions identify the caller to the worker; every other sign-in method is switched off |
| **Functions** | `worker` is the only writer of anything: verified user writes, plus the hourly recompute of `price_stats`, counters and standing (it also starts a recompute right after a write, so a new price reaches the range in seconds). `fair-range` is the public, read-only API |
| **Realtime** | Answers stream to every open question page, filtered server-side with a query (measured at 210–340 ms) |
| **Storage** | Private `receipts` bucket (2 MB, images, encrypted). A receipt is readable only by the person who uploaded it |
| **Sites** | Next.js app with server rendering, so the card arrives as HTML on slow connections |

## Quality

Everything below runs against the real backend, as real signed-in users, and cleans up after itself.

| Check | Command | Covers |
| --- | --- | --- |
| Unit tests | `npm test` | Weighted percentiles, decay, standing, three-flag hide, confidence, overcharge, scope fallback, geo, input rules (15 tests) |
| Write-path suite | `npm run test:e2e` | 39 checks as 5 real accounts: identity can't be forged, bad input is rejected with advice, receipts can't be stolen or reused, one confirmation and one flag each, third flag hides, daily limit, idempotent retries, the range updates within seconds |
| UI journey | `node scripts/with-key.mjs npx tsx scripts/e2e-ui.ts <url>` | 18 steps on a phone viewport: sign up through the log form, receipt upload, confirm, flag, ask, answer live, edit profile, sign out and in, offline queue |
| Accessibility | `node scripts/a11y.mjs <url>` | axe-core (WCAG 2.1 A/AA plus best practices) on every screen and the open sheets: 0 violations |
| Page speed | `node scripts/perf.mjs <url>` | Fast 3G and Slow 3G with a 4x slower CPU, cold cache |

## Repository

| Path | What |
| --- | --- |
| `appwrite.config.json` | The whole Appwrite project as code: database, tables, indexes, permissions, bucket, Functions, Site |
| `core/` | Pure, unit-tested logic shared by everything: stats engine, card model, geo, input rules (copied into each deploy target by `npm run sync:core`; edit `core/`, never the copies) |
| `functions/worker`, `functions/fair-range` | The two Functions (the free plan allows two) |
| `seed/` | Deterministic demo-data generator, reference data and seed runner |
| `web/` | Next.js app (App Router, Tailwind): marketing and app shells, server-rendered card pages |
| `scripts/` | Key minting, recompute, end-to-end and accessibility tests, cleanup |
| `docs/` | `gap-analysis.md` (version log), `ux-plan.md` (landing page, first run and user journey) |

## Run it

```bash
npm install -g appwrite-cli && appwrite login
npm install
npm test                    # unit tests
npm run seed:dry            # generate the dataset locally and print the seed checklist
npm run seed                # write it to Appwrite (mints a 1-hour API key), then recompute
npm run deploy:functions    # sync core/ and push both Functions
npm run deploy:web          # sync core/, deploy the site, then delete old builds
npm run prune               # delete all but the active build of the site and Functions
npm run stats               # recompute the fair ranges now (add -- --audit to count non-demo rows)
npm run test:e2e            # the write-path suite against your project

cd web && npm install && npm run dev
```

> **Free-plan note.** Every site deploy stores a full Next.js build (about 230 MB) and the plan includes 2 GB of storage, so nine deploys fill it and Appwrite blocks the whole project (HTTP 402) until usage drops. `deploy:web` and `deploy:functions` now delete old builds automatically; run `npm run warm` after a deploy, because the first requests to each route are slow while containers start.

## Demo data

**All current data is seeded for the hackathon demo, and the app says so on every screen** (the "Demo data" pill in the header and the footer note, which links to the explanation in the FAQ). It is generated by `seed/generate.ts`, deterministically from a fixed random seed:

- 3 cities, 120 real localities (coordinates cross-checked against OpenStreetMap), 21 items in 4 categories, 40 demo accounts.
- About 2,000 prices. Base prices are hand-set per city, with log-normal noise (σ ≈ 0.15), rounded the way people round, and dated mostly within the last 75 days.
- First quotes are 2–3x the fair price at stations and tourist spots, and 1.1–1.4x in residential areas.
- 10 deliberate outliers (a ₹900 auto per km, a ₹5 plumber visit) carry two flags each, so one more flag in the demo hides them.
- 15 sample questions with answers. Receipt images on demo prices are placeholders marked with a diagonal band.

Re-seeding only replaces rows marked `is_seed`; real people's prices are never touched.

## Open-source libraries

[Next.js](https://nextjs.org) · [React](https://react.dev) · [Tailwind CSS](https://tailwindcss.com) · [lucide-react](https://lucide.dev) · [Appwrite web SDK](https://github.com/appwrite/sdk-for-web) and [node-appwrite](https://github.com/appwrite/sdk-for-node) · [server-only](https://www.npmjs.com/package/server-only) · [TypeScript](https://www.typescriptlang.org) · [tsx](https://tsx.is) · [puppeteer-core](https://pptr.dev) and [axe-core](https://github.com/dequelabs/axe-core) (tests only).

## Roadmap

An MCP server so assistants can ask for fair prices directly · more cities, opened by questions · VectorsDB alias matching ("tuk tuk" → autorickshaw) · a Hindi interface · a moderation queue · groceries and rent.

# Second Opinion

**Every platform has a price; the informal economy has none.** Second Opinion is a verified, locality-level price layer for everything that isn't on an app: auto rides, plumbers, haircuts, street food. Locals log what they actually paid, newcomers check the fair range before they negotiate, and the community confirms or flags each other's numbers.

Built for the Appwrite Databases Hackathon on **Appwrite TablesDB**. Started on October 24, 2026.

- **Live app:** https://6adcc60d0036a5cd4f5c.appwrite.network
- **Public API:** https://6adcba4a001b8bfea9d0.appwrite.network/?item=auto-station-to-centre&lat=23.2223&lng=77.4380

```bash
curl "https://6adcba4a001b8bfea9d0.appwrite.network/?item=auto-station-to-centre&lat=23.2223&lng=77.4380"
# → ₹102, most people paid ₹95–110, High confidence, 26 logs from 17 people,
#   "first quotes here average 2.8x the fair rate"
```

## Why an LLM can't answer this

An assistant with an Uber or Maps MCP can quote a cab fare, because a company already built that database. The auto outside the station, the plumber your neighbour recommends, the barber, the chaiwala: no platform, no database, nothing to retrieve. Second Opinion is the thing that writes it down, with three properties a model can't supply on its own:

| | A model gives | Second Opinion gives |
| --- | --- | --- |
| Granularity | A city-level ballpark, often years old | A locality-level range from the last 90 days |
| Provenance | One number, no sample behind it | Median, typical range, N logs from M people, confidence badge |
| Verification | No way for a local to correct it | Confirmations, flags and reputation weighting; the range self-corrects |

And because the fair range is an API, the next assistant can ask Second Opinion directly.

## How it works

```
 browser ──writes──▶ price_logs, confirmations, flags, quote_checks, replies   (TablesDB)
    ▲                                   │
    │                       compute-stats Function (hourly + on demand)
    │                       weights · percentiles · confidence · overcharge
    │                                   ▼
    └──────reads─────── price_stats ◀── the only writer
                            │
              fair-range Function (public GET) ── same card, as JSON
```

- **The client writes raw rows and reads computed rows.** The only thing that turns one into the other is the `compute-stats` Function. It is idempotent: every run recomputes everything from the raw rows.
- **No single log is trusted.** Each log is weighted by its author's reputation × recency (e^(-days/45)) × 0.5 for new accounts × 2 with a receipt, plus 0.5 per same-city confirmation. The card shows the weighted median and the p25–p75 band.
- **Every number says how local and how sure it is.** The card prefers the locality and falls back to city, then state, when local data is thin. A fallback is labelled and capped at Medium confidence.
- **The overcharge index** is the median first quote divided by the median paid price in a locality. At Rani Kamlapati (Habibganj) station it is 2.8x; in residential Arera Colony it is 1.2x.
- **Three flags from different people hide a log.** Reputation moves +0.1 per confirmation and −0.3 per flag, recomputed from scratch on every run.
- **No vendor names, ever.** Prices belong to an item and an area, never a shop or a person.

## Appwrite usage

| Service | Used for |
| --- | --- |
| **TablesDB** | 11 tables, 20 indexes (including unique composite indexes that enforce one confirmation and one flag per user per log), table- and row-level permissions, bulk `createRows` / `upsertRows` / `deleteRows` |
| **Functions** | `compute-stats` (scheduled, plus on demand) is the only writer of `price_stats`, counters and reputation; `fair-range` is a public read-only API |
| **Realtime** | Quote Check replies stream to every open page, filtered server-side with a query (measured at 210–340 ms) |
| **Storage** | Private `receipts` bucket (2 MB, images, encrypted). Receipts are proof, not public content |
| **Sites** | Next.js app with server rendering, so the card arrives as HTML on slow connections |

## Repository

| Path | What |
| --- | --- |
| `appwrite.config.json` | The whole Appwrite project as code: database, tables, indexes, bucket, Functions, Site |
| `core/` | Pure, unit-tested logic shared by everything: stats engine, card model, geo resolution |
| `functions/compute-stats`, `functions/fair-range` | The two Functions (each gets a synced copy of `core/`) |
| `seed/` | Deterministic demo-data generator, reference data and seed runner |
| `web/` | Next.js app (App Router, Tailwind) |
| `docs/gap-analysis.md` | Version log: each release measured against the build plan's acceptance criteria |

## Run it

```bash
npm install -g appwrite-cli && appwrite login
npm install
npm test                  # core engine tests
npm run seed:dry          # generate the dataset locally and print the seed checklist
npm run seed              # write it to Appwrite (mints a 1-hour API key), then run compute-stats
npm run deploy:functions  # sync core/ and push both Functions
npm run stats             # trigger compute-stats now

cd web && npm install && npm run dev
```

## Demo data

**All current data is seeded for the hackathon demo, and the app says so on every screen.** It is generated by `seed/generate.ts`, deterministically from a fixed random seed:

- 3 cities, 120 real localities (coordinates cross-checked against OpenStreetMap), 21 items in 4 categories, 40 demo accounts.
- About 2,000 price logs. Base prices are hand-set per city, with log-normal noise (σ ≈ 0.15), rounded the way people round, and dated mostly within the last 75 days.
- First quotes are 2–3x the fair price at stations and tourist spots, and 1.1–1.4x in residential areas.
- 10 deliberate outliers (a ₹900 auto per km, a ₹5 plumber visit) carry two flags each, so one more flag in the demo hides them.
- Receipt images on demo logs are placeholders, marked with a diagonal band.

Re-seeding only replaces rows marked `is_seed`; real users' logs are never touched.

## Tech

Appwrite Cloud (TablesDB, Functions, Realtime, Storage, Sites) · Next.js 16 · React 19 · Tailwind CSS 4 · lucide-react · node-appwrite / appwrite SDKs · TypeScript · tsx.

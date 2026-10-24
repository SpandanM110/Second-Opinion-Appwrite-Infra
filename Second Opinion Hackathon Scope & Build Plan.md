# Second Opinion: Hackathon Scope & Build Plan

Oct 24, 2026 · @Spandan

## Overview

Second Opinion is a verified, locality-level price layer for the informal economy: locals log what they actually paid, newcomers check the fair range before they negotiate, and the community confirms or flags each other's numbers. It is built solo for the Appwrite Databases Hackathon on TablesDB, with a scheduled Function that turns raw logs into trusted statistics.

Positioning line: every platform has a price; the informal economy has none. Second Opinion builds the verified price layer for everything that isn't on an app, and exposes it to the apps and assistants that need it.

Hackathon constraints that shape every decision below:

- Submission deadline: October 31, 2026, 11:59 PM PT (about 12:30 PM IST on November 1). Internal target: submit by the evening of October 31 IST.
- Solo build, eight working days from October 24.
- Judged on idea, technical execution, design and experience, and depth of Appwrite Databases usage.
- Deliverables: public repo, a 2–3 minute demo video, optional live link.
- Demo footprint: three cities (Bhopal deepest), four categories, about 20 items, 300–500 seeded logs labelled as demo data.

## Problem and users

In Indian cities, most everyday transactions have no listed price, so the same auto ride, plumber visit, or haircut costs different people different amounts depending on how much they know. The people who know least (newcomers and travellers) pay the most, and the knowledge of locals is never written down anywhere searchable.

The product has two sides, and they are different people:

| Side | Who | What they want | What they give |
| --- | --- | --- | --- |
| Consumers | Students, transferred employees, tourists, anyone hiring a home service for the first time | A trustworthy fair range before they pay, for this exact item in this exact area, right now | Quote Check questions, which later become data points |
| Suppliers | Locals who have already paid for the thing many times | To stop others getting overcharged; recognition as a trusted local | Price logs, confirmations, flags, Quote Check replies |

Where people solve this today: city Reddit and Telegram groups ("is ₹300 fair from the station?"), friends on WhatsApp, and guesswork. Answers exist but are scattered, unsearchable, and unverified. That behaviour is the validation for Quote Checks.

The behaviour the product exists to create: check before you pay.

## Positioning: why an LLM, even with MCPs, can't do this

LLMs can answer price questions exactly as far as platforms reach, and the informal economy is where platforms stop. Second Opinion's moat is the dataset it creates, not the app that collects it.

What an LLM with MCPs can do: with an Uber, Maps, or Zomato MCP it can quote a cab fare, list nearby plumbers with ratings, or read a menu. Every one of those MCPs sits on a database a company already built.

Where that stops:

- The auto outside the station isn't on Uber, and the Uber fare isn't the fair auto fare (usually 30–60% higher, plus surge).
- The plumber your neighbour recommends has no listing with a visit charge.
- Barbers, chaiwalas, cycle repair, word-of-mouth movers: no platform, no database, no MCP.
- For a large share of everyday transactions in an Indian city there is nothing for a model to retrieve, because the data has never been written down.

Second Opinion is the thing that writes it down. Three properties follow that no model, with or without tools, can supply on its own:

| Property | What a model gives | What Second Opinion gives |
| --- | --- | --- |
| Granularity | A city-level ballpark, often years old | A locality-level range from the last 90 days |
| Provenance | One number, no sample behind it | Median, typical range, N logs from M distinct people, confidence badge |
| Verification | No way for a local to correct it | Confirmations, flags, reputation weighting; the range self-corrects |

The endgame flips the relationship: Second Opinion becomes the MCP. An assistant with the Second Opinion MCP can answer "is ₹300 fair from Bhopal station?" with 23 verified logs behind it. Without it, no model can. The hackathon build makes this concrete with a single read-only fair-range endpoint a judge can curl; the full MCP server is roadmap.

One-liner for the video: "ChatGPT can tell you Mumbai is expensive. Second Opinion tells you that 23 people paid ₹90–120 for this exact ride this month, and that the auto outside the station quotes 2.6x that."

Be honest in the demo: a model gives a decent ballpark and good negotiation tips. Don't compete there. Ask Gemini or ChatGPT the station question on camera and show its real answer next to the card; don't script what it says.

## Scope

The hackathon build is eight features, three cities, four categories, and nothing else until the video is recorded.

**In scope**

1. Log a price: item, GPS-snapped locality with manual override, price, type (paid / quoted / listed), optional receipt photo.
2. Fair-range card: trimmed median and typical range, 90-day recency weighting, locality → city → state fallback, confidence badge, "based on N logs from M people in the last D days".
3. Confirm and flag: one-tap "I paid about this too"; flag with reason; three flags hide a log from stats.
4. Reputation weighting: user score moves with confirmations and flags; new users count at half weight for their first 10 logs; receipt-backed logs count double.
5. Overcharge index per locality: median quoted price divided by median paid price for the same item.
6. Quote Checks: "quoted ₹X for Y in Z, fair?" posts with the current fair range auto-attached and realtime replies.
7. City-vs-city compare: one item, two cities, both ranges side by side.
8. Minimal profile: home city, reputation, log count, confirmations received.
9. Public read-only fair-range endpoint: an Appwrite Function at `GET /fair-range?item=&lat=&lng=` returning the same stats the card shows.

**Out of scope (roadmap)**

- Tips, badges, follows, weekly digests.
- Groceries and packaged goods (price-stable, unit-messy, less emotional).
- VectorsDB alias matching ("auto" = "autorickshaw" = "tuk tuk"); handled by a hand-written alias list for now.
- Full MCP server, moderation dashboard, vendor-side features, more than three cities.

**Non-negotiable product rules**

- No vendor or shop names, ever. Prices are tied to item plus locality only. This avoids defamation risk and keeps the schema small.
- Units are enforced at the item level (per km, per visit, per plate, each). Never free-text units.
- Every range shows how local it is and how confident it is. The app never shows a bare number.
- Seeded demo data is labelled as such in the UI and the README.
- Only `paid` and `listed` logs feed the fair range; `quoted` logs feed the overcharge index only.

**Demo footprint**

| Dimension | Choice | Why |
| --- | --- | --- |
| Cities | Bhopal (deepest), Indore, Mumbai | You can sanity-check Bhopal yourself; Mumbai gives a dramatic compare |
| Categories | Auto/cab, home services, haircuts, street food | Hyperlocal, emotional, easy to estimate realistic prices |
| Items | About 20 across the four categories | Enough variety for every screen to look alive |
| Logs | 300–500 seeded, skewed toward Bhopal | Every demo lookup should return Medium or High confidence |

## Feature spec

Each feature below is done when its acceptance criteria pass on seeded data. Build them in the order listed; each depends on the ones before it.

### F1. Log a price

As a local, I want to record what I paid in under 20 seconds so that the range for my area stays current.

- Item picker searches `items.name` and `items.aliases`; selecting an item shows its unit next to the price field.
- Locality is pre-filled from browser geolocation snapped to the nearest `localities` row within the detected city; a dropdown lets the user override.
- Price type defaults to `paid`; `quoted` and `listed` are one tap away with a one-line explanation of each.
- Optional receipt upload goes to Storage; the log stores `proof_file_id`.
- Acceptance: a new log appears in the city feed within 2 seconds; the next stats run includes it with the right weight.

### F2. Fair-range card

As a newcomer, I want to see what people really pay for this item near me, and how much to trust that, before I negotiate.

- Input: item plus either current GPS or a chosen locality.
- Output: median, typical range (p25–p75), confidence badge, scope label (locality / city-wide / state-wide), "N logs from M people, last D days", overcharge index if any `quoted` logs exist.
- Fallback: if the locality scope has fewer than 5 weighted logs, show the city scope with the label "city-wide, not enough local data"; if the city is thin, show state.
- Acceptance: every one of the 20 items returns a card for Bhopal with Medium or High confidence; an item with no data returns a clear "no data yet, be the first" state, never an empty card.

### F3. Confirm and flag

As a local, I want to vouch for or dispute a log so that bad numbers stop polluting the range.

- Confirm: one tap, one per user per log; shows a count on the log.
- Flag: pick a reason (typo, wrong unit, tourist price, vendor posting, other); one per user per log.
- Three flags set `hidden = true` on the log; hidden logs are excluded from stats and shown greyed in the feed with a "under review" tag.
- Acceptance: flagging a seeded outlier three times from three accounts removes it from the range on the next stats run.

### F4. Reputation weighting

As the system, I want trustworthy contributors to move the range more than strangers so that gaming is expensive.

- `users.reputation` starts at 1.0; +0.1 per confirmation received (cap 3.0), −0.3 per flag received (floor 0.2).
- Log weight = reputation × recency factor × 0.5 if user has under 10 logs × 2.0 if a receipt is attached.
- Acceptance: the same price logged by a 3.0-reputation user with a receipt shifts the median visibly more than by a fresh account; shown live in the demo.

### F5. Overcharge index

As a traveller, I want to know how much this locality's vendors inflate first quotes so that I know how hard to negotiate.

- Per item per locality: median of `quoted` logs divided by median of `paid` logs, last 90 days, minimum 3 of each.
- Displayed on the card as "first quotes here average 2.6x the fair rate".
- Acceptance: Bhopal station autos show an index above 2.0 in seed data; a residential locality shows close to 1.0.

### F6. Quote Checks

As a newcomer, I want to ask locals whether a quote is fair and get an answer fast.

- Post form: item, locality, quoted price, free-text body. On submit, the current fair-range card is attached automatically.
- Replies stream in via Realtime; the poster can mark one reply as helpful.
- Posting a Quote Check also writes a `quoted` log, so questions feed the overcharge index.
- Acceptance: a reply posted from a second browser appears in the first within 1 second without refresh.

### F7. City-vs-city compare

As someone moving between cities, I want to see how prices differ so that I recalibrate.

- Pick an item and two cities; show both city-scope cards side by side with the ratio between medians.
- Acceptance: auto per km, Bhopal vs Mumbai, renders both cards and a ratio.

### F8. Minimal profile

- Home city, reputation, logs count, confirmations received, member since.
- Acceptance: visible from any log or reply by tapping the author.

### F9. Fair-range endpoint

- `GET /fair-range?item=<slug>&lat=&lng=` returns JSON identical to what the card shows, with scope and confidence.
- Rate-limited, read-only, no auth required.
- Acceptance: a `curl` in the demo returns a well-formed response in under 500 ms.

## UI and UX design

The product is used standing on a pavement with an auto driver waiting, so the whole interface is built around one promise: an answer in three taps, readable at arm's length, on a phone, on a slow connection. Everything else (logging, verifying, asking) is one tap away from that answer, never in front of it.

**Design principles**

1. Answer first. The home screen is a search box and nothing else; the fair-range card is the destination of every path.
2. Never a bare number. Every price carries its range, its scope, its confidence and its age. If the app can't say how much to trust a number, it says that instead.
3. Contribution is a by-product. Checking leads naturally to "what did you end up paying?"; asking a Quote Check creates a log; confirming is one tap on something you already read.
4. Mobile first, thumb first. Primary actions sit in the bottom third of the screen; tap targets are at least 44 px; nothing important is behind a long press or a swipe.
5. Honest by default. Seeded data is labelled; fallbacks are labelled; hidden logs say why.

&#91;embedded content: Screen flow · 7 screens, 3 of them one tap from the card\]

Check and Feed are the two entry points; the card is where every check lands, and Log, Quote Check and Compare each sit one tap from it. Bottom tabs are Check, Feed and Me; Log is a floating button on every screen.

**Screen inventory**

| Screen | Purpose | Key elements | Primary action |
| --- | --- | --- | --- |
| Check (home) | Get a fair range fast | Big item search with recent and popular items; detected locality chip with change link; "demo data" banner | Pick an item → card |
| Fair-range card | The answer | Median large; p25–p75 band; confidence badge; scope label; "N logs from M people, last D days"; overcharge line; three buttons: I paid, Ask locals, Compare | I paid (opens Log pre-filled) |
| Log a price | Record a payment in under 20 s | Item (pre-filled if from card), locality chip, price keypad, unit shown inline, paid / quoted / listed segmented control, optional receipt, 140-char note | Save |
| Feed | What's happening in this city | Tabs: Quote Checks, Recent logs; each log has confirm and flag inline; each Quote Check shows its attached range and reply count | Open a Quote Check |
| Quote Check detail | Ask and answer | Question, attached card, replies in realtime, reply box; poster can mark a reply helpful | Reply |
| Compare | Two cities side by side | Item picker, two city pickers (defaults: home city and current city), two mini cards, ratio line | Change cities |
| Profile | Who am I here | Home city, reputation, logs, confirmations received, member since, my logs with hidden-state reasons | Edit home city |
| Onboarding (first run only) | Set home city, explain the three price types | Two screens, skippable, no sign-in required to check | Start checking |

Sign-in is required only to log, confirm, flag, ask or reply; checking is anonymous, so the first value arrives before any friction.

**Fair-range card anatomy (top to bottom)**

1. Item name and unit, e.g. "Auto, per km".
2. Scope chip: "in MP Nagar" or "city-wide · not enough local data" or "state-wide estimate".
3. The median, large (32 px): "₹105".
4. The band, smaller: "most people paid ₹90–120".
5. Confidence badge with a one-line reason on tap: "High · 23 logs from 11 people in the last 60 days".
6. Overcharge line, only when present: "first quotes here average 2.6x this".
7. Three equal buttons: I paid, Ask locals, Compare.
8. Below the fold: the most recent five logs with confirm and flag, and "see all".

**The three core flows, counted in taps**

| Flow | Taps | Steps |
| --- | --- | --- |
| Check a price | 2–3 | Open app → tap item (recent or search) → card. Locality is detected; changing it is a third tap |
| Log a price from a card | 3 | Card → I paid → type amount → Save (type defaults to paid, locality and item pre-filled) |
| Ask locals | 3 | Card → Ask locals → type quoted amount and one line → Post (card auto-attached) |

**States the UI must handle well**

| State | What the user sees | Why it matters |
| --- | --- | --- |
| No data for this item here | "No one has logged this in Bhopal yet. Be the first" with a Log button | Turns a dead end into a contribution |
| Low confidence | Badge in a neutral grey, number shown with "treat as a rough guide" | Honesty keeps trust in the High badges |
| Fallback to city or state | Scope chip changes colour and wording; locality name is not shown | Prevents a city number looking hyperlocal |
| GPS denied or wrong | Locality chip reads "Choose your area" and opens the picker | Core flow never blocks on permissions |
| Log hidden by flags | Greyed row with "under review: wrong unit (3 flags)" visible to the author | Lets honest mistakes be re-logged |
| Offline or slow network | Last fetched card shown with "as of 2 min ago"; log queued and sent on reconnect | Pavement conditions are real |
| Seeded demo data | Thin banner at the bottom: "Demo data for the hackathon; real logs start now" | Judges respect it; users aren't misled |

**Visual language**

- One accent colour for actions; confidence uses meaning colours (High green, Medium amber, Low grey), never the accent, so a confident number and a button are never confused.
- Prices in a tabular numeral face, large and left-aligned; the ₹ symbol smaller than the digits.
- Locality and scope chips are the only coloured text; everything else is near-black on white.
- Cards, not tables, on mobile; the compare screen is the one place two cards sit side by side.
- Receipts show as a small thumbnail with a receipt icon; tapping opens full size. Never inline at full width.

**Microcopy rules**

- Plain Indian English, numbers first: "₹90–120 · 23 people" before any sentence.
- Price types explained once, inline: paid = what you handed over; quoted = what you were asked first; listed = on a board or menu.
- Confidence reasons are sentences, not icons: "only 4 logs so far".
- Never "error" or "invalid"; say what to do: "that's 20x the usual range here, double-check the unit".

**Accessibility and performance**

- 44 px tap targets, 4.5:1 contrast on all text, visible focus states, labels on every input.
- Works at 320 px width; the card is readable without zoom.
- First card under 2 seconds on a 3G connection: `price_stats` reads are single-row, assets are minimal, no blocking fonts.
- Hindi UI toggle is roadmap; item aliases already include common Hindi names so search works in either language.

**UX scope for the hackathon**

Build Check, Card, Log, Feed, Quote Check detail, Compare and a minimal Profile. Onboarding is two static screens. Skip animations, dark mode and settings. The one screen to over-invest in is the card: it appears in every demo scene and carries the "Design and experience" score almost alone.

## Trust and verification design

Verify the range, not the individual log. No single log is ever trusted; the statistics are built so that one wrong, old, or malicious number barely moves the result, and the community can remove it.

**Log weight**

Each log carries a weight computed at stats time:

```latex
w = r \cdot e^{-d/45} \cdot n \cdot p
```

where `r` is the author's reputation (0.2–3.0), `d` is the log's age in days, `n` is 0.5 if the author has fewer than 10 logs else 1.0, and `p` is 2.0 if a receipt is attached else 1.0. Logs older than 90 days or with `hidden = true` are excluded entirely. The half-life of about 31 days means last month's prices still count but last quarter's barely do.

**Fair range**

For a given item and scope, take all eligible `paid` and `listed` logs, sort by price, and compute the weighted 10th, 25th, 50th, 75th and 90th percentiles. The card shows the weighted median and the p25–p75 band. The p10 and p90 are stored for the compare view and future use. Weighted percentiles make a receipt-backed log from a trusted local count as roughly four fresh anonymous logs.

**Fallback and scope**

| Condition | Scope shown | Label on the card |
| --- | --- | --- |
| Locality has ≥ 5 weighted logs | Locality | "in MP Nagar" |
| Locality thin, city has ≥ 5 | City | "city-wide, not enough local data" |
| City thin, state has ≥ 5 | State | "state-wide estimate" |
| All thin | None | "no data yet, be the first to log" |

**Confidence badge**

| Badge | Weighted logs | Distinct users | Spread (p75 ÷ p25) | Newest log |
| --- | --- | --- | --- | --- |
| High | ≥ 15 | ≥ 3 | ≤ 1.5 | ≤ 30 days |
| Medium | 5–14, or any High condition failing | ≥ 2 | ≤ 2.5 | ≤ 90 days |
| Low | < 5 | any | any | any |

A scope that falls back is capped at Medium even if the parent scope would score High, so a city-wide number never looks hyperlocal.

**Confirmations and flags**

- A confirmation adds 0.5 to the log's effective weight and +0.1 to the author's reputation. Confirmations from users in the same city count; cross-city confirmations are stored but not weighted.
- A flag subtracts 0.3 from the author's reputation. Three flags from distinct users set `hidden = true`.
- Hidden logs stay visible to their author with the reason list, so honest mistakes (wrong unit) can be re-logged correctly.
- A user cannot confirm or flag their own log, and cannot act twice on the same log.

**Overcharge index**

Per item per locality, last 90 days, minimum 3 `quoted` and 3 `paid` logs:

```latex
O = \frac{\text{median}(\text{quoted})}{\text{median}(\text{paid})}
```

Shown as "first quotes here average 2.6x the fair rate" when O ≥ 1.2; hidden below that to avoid noise. Quote Check posts automatically contribute a `quoted` log, so questions make this index better.

**Anti-gaming summary**

| Attack | Defence |
| --- | --- |
| Vendor posts inflated prices | Half weight for new accounts; trimmed percentiles; flags from locals |
| Bot floods one locality | Rate limit of 20 logs per user per day; distinct-user count in confidence |
| Wrong unit (₹ per kg vs per 250 g) | Units fixed per item; unit shown beside the price field |
| Stale data misleading travellers | 90-day window, exponential decay, newest-log date on the card |
| Defamation of a specific shop | No vendor names anywhere in the schema |

## Geography model

Every log is stored at the lowest level known (a locality plus raw coordinates), and every lookup walks up the hierarchy until it finds enough data. Country → State → City → Locality, with India → Madhya Pradesh → Bhopal → MP Nagar as the running example.

**Resolving a user's location**

1. Ask the browser for coordinates. If granted, find the nearest `cities` row within 40 km, then the nearest `localities` row in that city within 3 km.
2. If no locality is within 3 km, keep the city and store `locality_id = null`; the log counts toward city scope only.
3. If geolocation is denied or wrong, the user picks city then locality from dropdowns. The override is always visible, never buried.
4. Store `lat` and `lng` on the log regardless, so localities can be redrawn later without losing data.

Distance is a plain haversine in the Function; TablesDB has no geo index and doesn't need one at this scale (about 120 localities across three cities).

**Hyperlocal vs city-level items**

Categories carry a `hyperlocal` flag. Auto/cab, home services and haircuts are hyperlocal and prefer locality scope. Street food is semi-local and defaults to city scope with a locality breakdown available. Groceries, when added later, would be city-level. The flag decides which scope the card tries first and keeps thin localities from showing Low confidence for items where locality doesn't matter.

**Localities per city for the demo**

| City | Localities seeded | Examples |
| --- | --- | --- |
| Bhopal | 40 | MP Nagar, Arera Colony, Kolar, Habibganj station area, New Market, Bairagarh, Hoshangabad Road |
| Indore | 40 | Vijay Nagar, Palasia, Rajwada, Bhawarkua, Sarwate bus stand area |
| Mumbai | 40 | Andheri West, Bandra, Dadar, Powai, Kurla, Colaba |

Station and bus-stand localities are seeded deliberately with high `quoted` prices so the overcharge index has something to show.

**City-vs-city compare**

Compare always uses city scope for both sides, never locality, so the two numbers are like for like. The card shows both medians, both bands, both confidence badges, and the ratio. If either city is thin the ratio is suppressed and a note says why.

## Data model (TablesDB)

Eleven tables in one database: five reference tables seeded once, four tables users write to, one computed table the Function owns, and one for users. Raw logs are append-only; all reads for the card hit `price_stats`.

| Table | Columns (type) | Indexes | Row-level permissions |
| --- | --- | --- | --- |
| `cities` | name (string), state (string), country (string), lat (float), lng (float), slug (string) | slug unique | Read: any. Write: none (seeded) |
| `localities` | city\_id (string), name (string), lat (float), lng (float), kind (enum: residential, transit\_hub, market, tourist) | city\_id | Read: any. Write: none |
| `categories` | name (string), unit (enum: per\_km, per\_visit, per\_hour, per\_plate, each), hyperlocal (bool) | — | Read: any. Write: none |
| `items` | category\_id (string), name (string), slug (string), aliases (string\[\]), typical\_min (int), typical\_max (int) | slug unique, category\_id | Read: any. Write: none |
| `users` | auth\_id (string), display\_name (string), home\_city\_id (string), reputation (float, default 1.0), log\_count (int), confirmations\_received (int), flags\_received (int) | auth\_id unique | Read: any. Update: owner (display fields only); reputation fields updated by Function |
| `price_logs` | item\_id, locality\_id (nullable), city\_id, user\_id, price (int, paise or whole rupees; use whole rupees), price\_type (enum: paid, quoted, listed), lat (float), lng (float), proof\_file\_id (nullable), note (string, 140), confirm\_count (int), flag\_count (int), hidden (bool), created\_at (datetime) | item\_id+city\_id, item\_id+locality\_id, user\_id, created\_at | Create: any user. Read: any. Update: Function only (counts, hidden) |
| `confirmations` | log\_id, user\_id, city\_id, created\_at | log\_id+user\_id unique | Create: any user. Read: any |
| `flags` | log\_id, user\_id, reason (enum: typo, wrong\_unit, tourist\_price, vendor\_posting, other), created\_at | log\_id+user\_id unique | Create: any user. Read: Function |
| `price_stats` | item\_id, scope\_type (enum: locality, city, state), scope\_id, median (int), p10, p25, p75, p90 (int), n\_weighted (float), n\_raw (int), distinct\_users (int), newest\_log\_at (datetime), confidence (enum: high, medium, low), overcharge\_index (float, nullable), computed\_at (datetime) | item\_id+scope\_type+scope\_id unique | Read: any. Write: Function only |
| `quote_checks` | user\_id, item\_id, locality\_id, city\_id, quoted\_price (int), body (string, 500), attached\_stats\_id (string), reply\_count (int), created\_at | city\_id+created\_at, item\_id | Create: any user. Read: any. Update: owner |
| `replies` | quote\_check\_id, user\_id, body (string, 500), helpful (bool), created\_at | quote\_check\_id+created\_at | Create: any user. Read: any. Update: quote\_check owner (helpful only) |

**Notes**

- `typical_min` and `typical_max` on `items` are sanity bounds used only to reject obvious typos at input (a ₹50,000 auto ride) and to generate seed data. They never feed the stats.
- `city_id` is denormalised onto `price_logs`, `confirmations` and `quote_checks` so the city feed and same-city confirmation rule are single-filter queries.
- `confirm_count` and `flag_count` are maintained by the Function, not the client, so a user can't fake them.
- Storage: one bucket `receipts`, max 2 MB per file, images only, read restricted to the uploader and the stats Function. Receipts are proof, not public content.
- No vendor name column exists anywhere. If a user types a shop name into `note`, the UI shows a hint asking them not to; this is a rule, not a filter, for the hackathon.

## Appwrite architecture

The client writes raw rows and reads computed rows; the only thing that turns one into the other is a scheduled Function. That separation is what makes the "Usage of Appwrite Databases" story legible in twenty seconds.

&#91;embedded content: Appwrite architecture · 4 services, 2 Functions\]

The browser writes `price_logs`, `confirmations`, `flags`, `quote_checks` and `replies` and reads `price_stats`; the Stats Function is the only writer of `price_stats` and of reputation fields; Realtime pushes new replies to every open Quote Check; the fair-range endpoint serves the same `price_stats` rows as JSON.

**Data flow for one price log**

1. User submits a log; the client inserts a `price_logs` row with `city_id`, `locality_id`, coordinates and `price_type`. If a receipt was attached, it is uploaded to Storage first and the file id stored on the row.
2. The city feed shows it immediately (a direct TablesDB query, newest first).
3. On the next run, the Stats Function fetches eligible logs per item and scope, applies weights, computes percentiles, confidence and overcharge index, and upserts `price_stats` rows. It also recomputes `users.reputation` and the `confirm_count`, `flag_count` and `hidden` fields on logs.
4. The fair-range card reads one `price_stats` row (or falls back to the parent scope) and renders.

**Function details**

| Function | Trigger | Reads | Writes | Notes |
| --- | --- | --- | --- | --- |
| `compute-stats` | Schedule every 30 min, plus a manual HTTP trigger for the demo | `price_logs`, `confirmations`, `flags`, `users`, `localities` | `price_stats`, `users` reputation fields, `price_logs` counts and `hidden` | Node runtime; paginate reads at 100 rows; idempotent, so re-runs are safe |
| `fair-range` | HTTP GET, public | `price_stats`, `localities`, `cities` | none | Resolves lat/lng to locality and city with haversine, applies fallback, returns JSON; 60 requests per minute per IP |

**Permissions in one line each**

- Reference tables: read by any, written only by the seed script with an API key.
- User-written tables: create by any signed-in user; rows readable by any; updates limited to the owner's own display fields.
- `price_stats`: read by any; written only by the Function's API key.
- Receipts bucket: read by the uploader and the Function; never public.

**Hosting**: static front end on Appwrite Sites (or Vercel if Sites gives trouble on day 1), Appwrite Cloud for everything else, one project, one database.

## Seed data strategy

The demo lives or dies on the seed. Build one idempotent script (`seed.ts`, run with the Appwrite server SDK) that wipes and recreates everything, so you can re-seed on October 30 after schema changes without hand-fixing data.

**Reference data (hand-written JSON)**

- 3 cities, 120 localities (40 each) with real coordinates and a `kind`.
- 4 categories, about 20 items with slugs, aliases and sanity bounds. Starter list:

| Category | Items | Unit |
| --- | --- | --- |
| Auto/cab | auto per km, auto minimum fare, auto station-to-centre, cab per km, bike taxi per km | per\_km or each |
| Home services | plumber visit, electrician visit, AC service, RO service, house cleaning (2 BHK), painter per day | per\_visit or per\_hour |
| Haircuts | men's haircut, men's haircut + beard, women's haircut, kids' haircut | each |
| Street food | chai, samosa, poha-jalebi plate, vada pav, dosa, thali (local) | per\_plate or each |

**Users (40 fake accounts)**

- 20 Bhopal, 10 Indore, 10 Mumbai, with varied reputation (0.6 to 2.8) and log counts, so the weighting demo has visible contrast. Two accounts are "trusted locals" with receipts on most logs; two are "new accounts" with under 10 logs.

**Price logs (300–500)**

Generate per item per city from a base price and a spread, then adjust by locality `kind`:

- `paid` logs: base × log-normal noise (σ ≈ 0.15), dated uniformly over the last 75 days, 60% with `locality_id`, 40% city-only.
- `quoted` logs: same base × 1.1–1.4 for residential localities, × 2.0–3.0 for `transit_hub` and `tourist`, so the overcharge index is dramatic exactly where it should be.
- `listed` logs: for street food and haircuts only, near the base, 15% of volume.
- 3–4 deliberate outliers per city (a ₹900 auto per km, a ₹5 plumber visit) with zero confirmations, for the flagging demo.
- Receipts: attach 20 placeholder receipt images to trusted-local logs.

**Social data**

- 15 Quote Checks (8 Bhopal, 4 Indore, 3 Mumbai), each with 1–4 replies, dated over the last two weeks, a few with a `helpful` reply marked.
- 60–80 confirmations spread across recent logs; 6 flags on the outliers (two each, so one more flag in the demo hides them).

**Labelling**

A banner in the app footer and a line in the README say that current data is seeded for demonstration and describe how it was generated. Judges respect honesty about this more than they penalise it.

**Checklist**

- [ ] `seed.ts` wipes and recreates all tables and the receipts bucket
- [ ] Every item returns Medium or High confidence for Bhopal city scope
- [ ] At least 6 Bhopal localities return High confidence for auto per km
- [ ] Habibganj station shows an overcharge index above 2.0
- [ ] Outliers exist and are flaggable in the demo
- [ ] Stats Function has been run once after seeding

## Eight-day build plan

Each day ends with one thing working on seeded data; if a day's deliverable isn't done, the next day starts by finishing it, not by starting the next feature.

&#91;embedded content: Eight-day build plan · 7 deliverables, 2 milestones\]

The first two days are the only ones with room to slip; everything after October 26 is a single feature per day, and October 30 is the last day any code changes.

**Done means**

- [ ] **Oct 24–25:** Appwrite project created; all 11 tables and indexes exist; `seed.ts` populates cities, localities, categories, items, users and 300+ logs; GitHub sign-in works; the Stats Function deploys and runs a trivial job on a schedule.
- [ ] **Oct 26:** Log-a-price flow end to end, including GPS snap with override and receipt upload; new logs show in the city feed.
- [ ] **Oct 27:** Stats Function computes weights, percentiles and confidence into `price_stats`; the fair-range card renders with fallback and badge for every seeded item.
- [ ] **Oct 28:** Confirm and flag work; three flags hide a log; reputation updates; overcharge index appears on station localities.
- [ ] **Oct 29:** Quote Checks post with the card attached; replies stream over Realtime between two browsers; city-vs-city compare renders. Scope freeze at end of day.
- [ ] **Oct 30:** Profile page; `/fair-range` endpoint returns JSON; mobile layout checked; demo-data banner in place; full re-seed; every acceptance criterion in the feature spec passes.
- [ ] **Oct 31:** Video recorded scene by scene and stitched; README written; live link up; submitted on hackathon.appwrite.io by the evening IST.

**If you fall a day behind**

Drop in this order: city-vs-city compare, the public endpoint, receipt upload, profile page. The video still tells the whole story with F1 through F6.

## Demo video script and submission checklist

Target 2 minutes 30 seconds, screen recording with voice-over, no slides except one architecture frame at the end. Open on the problem, not the app.

| Time | Scene | What's on screen | What you say |
| --- | --- | --- | --- |
| 0:00–0:15 | Hook | Gemini or ChatGPT answering "fair auto fare Habibganj station to MP Nagar?" with its real reply | "Here's what an AI says. It has no idea, because nobody ever wrote this price down." |
| 0:15–0:40 | Quote Check | Post "Quoted ₹300 station to MP Nagar, fair?"; fair-range card auto-attaches: ₹90–120, High, 23 logs from 11 people, overcharge index 2.6x | "Second Opinion knows, because 11 locals logged it this month. And it knows the station autos quote 2.6 times that." |
| 0:40–1:05 | Log a price | Log ₹100 paid with a receipt photo; show the log in the city feed; trigger the stats Function; card updates | "Every payment becomes a data point. Receipts and reputation make yours count more." |
| 1:05–1:30 | Verification | Confirm a log from a second browser; flag a ₹900 outlier a third time; it greys out; re-run stats; range tightens | "The community keeps it honest. Three flags and a bad number is out." |
| 1:30–1:50 | Compare | Auto per km, Bhopal vs Mumbai, side by side with ratio | "Moving cities? Recalibrate in one tap." |
| 1:50–2:10 | Realtime | Reply to the Quote Check from the second browser; it appears instantly in the first | "And real locals answer in real time." |
| 2:10–2:30 | Architecture + endpoint | One frame: TablesDB (11 tables) → scheduled Function → `price_stats` → card, Realtime, Storage; then a `curl` to `/fair-range` returning JSON | "Raw logs in, verified truth out, all on Appwrite TablesDB. And it's an API, so the next AI assistant can ask it too." |

**Recording tips**

- Record in one take per scene and stitch; don't try a single take.
- Two browser windows side by side for the realtime and confirmation scenes.
- Run the stats Function manually on camera (or set its schedule to every 5 minutes for the recording).
- Keep the "demo data" banner visible; say it once.

**Submission checklist**

- [ ] Public repo with README: what it is, the positioning paragraph, architecture diagram, setup steps, seed instructions, tech stack including every open-source library used
- [ ] README states clearly that the project was started on or after October 19
- [ ] Demo video uploaded (YouTube unlisted or similar), 2–3 minutes
- [ ] Live deployment on Appwrite Sites or Vercel, pointed at the seeded Appwrite project
- [ ] `/fair-range` endpoint reachable publicly
- [ ] Signed in to hackathon.appwrite.io with GitHub; project submitted via the dashboard
- [ ] Submitted by the evening of October 31 IST (deadline is 11:59 PM PT, about 12:30 PM IST November 1)

## Risks for the hackathon week

Scope is the only risk that can sink the submission; everything else has a cheap fallback.

| Risk | Likelihood | Impact | Mitigation | Fallback if it hits |
| --- | --- | --- | --- | --- |
| Scope creep eats the last two days | High | Critical | The In/Out list above; no new feature after October 29 | Cut F7 compare and F9 endpoint first; the video still works without them |
| TablesDB query limits or missing aggregation | Medium | High | All aggregation runs in the Function over fetched rows, never in queries; paginate at 100 | Precompute stats in the seed script and ship them static if the Function misbehaves |
| Scheduled Function setup takes longer than expected | Medium | Medium | Set it up on day 1, not day 4; test with a trivial function first | Run stats on demand via a button in the demo |
| Geolocation flaky in the browser during recording | Medium | Low | Manual locality override is always visible | Use the dropdown on camera |
| Realtime subscription drops | Low | Medium | Subscribe per quote check, reconnect on visibility change | Poll every 3 seconds as a fallback |
| Seed data looks fake or thin | Medium | High | Log-normal noise, varied dates, varied users; sanity-check Bhopal prices yourself | Re-seed with adjusted bases on October 30 |
| Receipt upload permissions wrong | Low | Low | Test upload and read on day 2 | Drop receipts from the recorded demo, keep the weight logic |
| Video runs long or has to be re-recorded | Medium | Medium | Script above with timings; record scene by scene | Cut the compare scene |
| Burnout on a solo eight-day sprint | Medium | High | Each day has one deliverable; stop when it's done | Days 5 and 6 have slack built in |

## Roadmap after the hackathon

The hackathon build proves the data layer works; the roadmap turns it into the thing assistants and apps query. Ordered by the sequence that compounds best.

1. **MCP server** exposing fair-range, overcharge index, and compare as tools. Position Second Opinion as the ground-truth layer for informal prices that any assistant can plug in.
2. **More cities, bootstrapped through Quote Checks.** Launch a city with zero logs but an active question feed; locals answering becomes the first data.
3. **VectorsDB alias matching** so free-text items ("tuk tuk", "AC gas refill") resolve to canonical items without a hand-maintained list.
4. **Social layer:** follow cities, tips on items, badges (Local Expert, Receipt Keeper), weekly price-moved digests.
5. **Moderation tooling:** review queue for hidden logs, appeal flow, abuse reports.
6. **Groceries and rent** once unit handling and locality coverage are mature enough.
7. **Vendor-side transparency (carefully):** let a vendor publish a rate card as `listed` logs, never as a named profile.

Success metrics once real users arrive: share of lookups returning Medium or High confidence (north star), logs per city per week, percentage of logs confirmed by a second user, and weekly returning users.

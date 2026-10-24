// Deterministic demo dataset for Second Opinion (see "Seed data strategy" in the build plan).
// Same PRNG seed + same `now` day → same rows, so re-seeding is reproducible.

import citiesJson from './data/cities.json' with { type: 'json' };
import localitiesJson from './data/localities.json' with { type: 'json' };
import itemsJson from './data/items.json' with { type: 'json' };
import { slugify } from '../core/engine.js';

type Kind = 'residential' | 'transit_hub' | 'market' | 'tourist';
type PriceType = 'paid' | 'quoted' | 'listed';
type CityId = 'bhopal' | 'indore' | 'mumbai';

export interface Row { $id: string; [k: string]: unknown }

const DAY_MS = 86_400_000;
const CITY_SHORT: Record<CityId, string> = { bhopal: 'bpl', indore: 'idr', mumbai: 'bom' };
// Bhopal is the deep city; the other two exist for compare and breadth.
const CITY_VOLUME: Record<CityId, number> = { bhopal: 1, indore: 0.42, mumbai: 0.42 };
const LOGS_PER_VOLUME = 34;

// ---------- PRNG ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = mulberry32(20261024);
const between = (lo: number, hi: number) => lo + (hi - lo) * rand();
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;
const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
function weightedPick<T>(xs: readonly T[], weight: (x: T) => number): T {
  const total = xs.reduce((s, x) => s + weight(x), 0);
  let r = rand() * total;
  for (const x of xs) if ((r -= weight(x)) <= 0) return x;
  return xs[xs.length - 1];
}

// People log round numbers.
function humanPrice(x: number) {
  if (x < 40) return Math.max(1, Math.round(x));
  if (x < 300) return Math.round(x / 5) * 5;
  if (x < 2000) return Math.round(x / 10) * 10;
  return Math.round(x / 50) * 50;
}

// ---------- reference data ----------
export const cities: Row[] = citiesJson.map((c) => ({
  $id: c.id, name: c.name, state: c.state, country: c.country, lat: c.lat, lng: c.lng, slug: c.id,
}));

export const localities: Row[] = Object.entries(localitiesJson as Record<string, [string, number, number, Kind][]>).flatMap(
  ([cityId, rows]) =>
    rows.map(([name, lat, lng, kind]) => ({
      $id: `${CITY_SHORT[cityId as CityId]}-${slugify(name.replace(/\(.*?\)/g, ''))}`.slice(0, 36).replace(/-$/, ''),
      city_id: cityId, name, lat, lng, kind,
    })),
);

export const categories: Row[] = itemsJson.categories.map((c) => ({ $id: c.id, name: c.name, unit: c.unit, hyperlocal: c.hyperlocal }));

type ItemDef = (typeof itemsJson.items)[number] & { listed?: boolean; stationHeavy?: boolean };
const itemDefs = itemsJson.items as ItemDef[];

export const items: Row[] = itemDefs.map((i) => {
  const bases = Object.values(i.base);
  return {
    $id: i.id, category_id: i.category, name: i.name, slug: i.id, aliases: i.aliases, unit: i.unit,
    // Sanity bounds for input validation only; never used in stats.
    typical_min: Math.max(1, Math.floor(Math.min(...bases) * 0.3)),
    typical_max: Math.ceil(Math.max(...bases) * 4),
  };
});

// ---------- users ----------
const FIRST = ['Aarav', 'Priya', 'Rohan', 'Ananya', 'Vikram', 'Sneha', 'Arjun', 'Kavya', 'Rahul', 'Ishita', 'Siddharth', 'Meera',
  'Karan', 'Pooja', 'Aditya', 'Neha', 'Manish', 'Riya', 'Saurabh', 'Divya', 'Nikhil', 'Tanvi', 'Harsh', 'Shreya', 'Amit',
  'Nandini', 'Varun', 'Aisha', 'Kunal', 'Sakshi', 'Yash', 'Anjali', 'Deepak', 'Kritika', 'Mohit', 'Bhavna', 'Gaurav', 'Swati',
  'Imran', 'Farah'];
const LAST_INITIAL = 'SKMPTRGJDBNVAC';

type Role = 'trusted' | 'regular' | 'new' | 'sloppy';
interface SeedUser extends Row { home_city_id: CityId; role: Role; activity: number }

const homeOf = (i: number): CityId => (i < 20 ? 'bhopal' : i < 30 ? 'indore' : 'mumbai');
const roleOf = (i: number): Role =>
  i === 0 || i === 1 ? 'trusted' : i === 18 || i === 38 ? 'new' : i === 17 || i === 28 || i === 37 ? 'sloppy' : 'regular';

export const seedUsers: SeedUser[] = FIRST.map((first, i) => {
  const role = roleOf(i);
  return {
    $id: `seed-u${String(i + 1).padStart(2, '0')}`,
    auth_id: `seed:${String(i + 1).padStart(2, '0')}`,
    display_name: `${first} ${LAST_INITIAL[i % LAST_INITIAL.length]}.`,
    home_city_id: homeOf(i),
    role,
    activity: role === 'trusted' ? 3.2 : role === 'new' ? 0 : role === 'sloppy' ? 0.5 : 0.6 + 1.2 * ((i * 37) % 10) / 10,
  };
});

export const users: Row[] = seedUsers.map(({ role: _r, activity: _a, ...u }) => ({ ...u, reputation: 1, log_count: 0, confirmations_received: 0, flags_received: 0, is_seed: true }));

// ---------- price logs ----------
export interface LogRow extends Row {
  item_id: string; locality_id: string | null; city_id: string; user_id: string; price: number;
  price_type: PriceType; lat: number | null; lng: number | null; proof_file_id: string | null;
  note: string | null; created_at: string; is_seed: true; needsReceipt?: boolean;
}

const localitiesByCity = (city: CityId) => localities.filter((l) => l.city_id === city);
const kindOf = (localityId: string | null) => (localities.find((l) => l.$id === localityId)?.kind as Kind) ?? null;

const BHOPAL_HOTSPOTS = ['bpl-mp-nagar', 'bpl-arera-colony', 'bpl-new-market', 'bpl-kolar-road', 'bpl-shahpura', 'bpl-tt-nagar',
  'bpl-rani-kamlapati-station', 'bpl-bhopal-junction-station', 'bpl-ayodhya-bypass', 'bpl-bittan-market'];

// Popularity: a few localities carry most of the logs, like real usage.
function localityPopularity(city: CityId) {
  const ls = localitiesByCity(city);
  const order = [...ls].sort((a, b) => (a.$id < b.$id ? -1 : 1));
  const shuffled = order.map((l, i) => ({ l, k: ((i * 7919) % 101) / 101 })).sort((a, b) => a.k - b.k).map((x) => x.l);
  // Hand-picked hotspots first for Bhopal so the demo localities are deep.
  const hot = city === 'bhopal' ? BHOPAL_HOTSPOTS : [];
  const ranked = [...hot.map((id) => ls.find((l) => l.$id === id)!).filter(Boolean), ...shuffled.filter((l) => !hot.includes(l.$id))];
  return new Map(ranked.map((l, rank) => [l.$id, 1 / Math.pow(rank + 1.5, 0.95)]));
}

function ageDays() {
  // Skewed recent: the app is growing, and recency is what the card rewards.
  return 75 * Math.pow(rand(), 1.6);
}

function timestamp(now: Date, days: number) {
  const d = new Date(now.getTime() - days * DAY_MS);
  // Keep logs within 07:00–22:00 IST.
  const istHour = 7 + rand() * 15;
  d.setUTCHours(Math.floor(istHour - 5.5 + 24) % 24, Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
  if (d.getTime() > now.getTime()) d.setTime(now.getTime() - rand() * 3_600_000);
  return d.toISOString();
}

function jitter(l: Row | undefined, city: Row) {
  const base = l ?? city;
  const spread = l ? 0.006 : 0.04;
  return { lat: +((base.lat as number) + between(-spread, spread)).toFixed(5), lng: +((base.lng as number) + between(-spread, spread)).toFixed(5) };
}

const PAID_KIND_FACTOR: Record<Kind, number> = { residential: 0.97, market: 1, transit_hub: 1.08, tourist: 1.12 };

function quotedFactor(category: string, kind: Kind | null) {
  const touristy = kind === 'transit_hub' || kind === 'tourist';
  if (category === 'auto-cab') return touristy ? between(2.0, 3.0) : between(1.1, 1.4);
  return touristy ? between(1.3, 1.7) : between(1.1, 1.35);
}

const NOTES = ['', '', '', '', '', 'after some bargaining', 'evening rate', 'fixed price, no bargaining', 'first visit', 'regular place', 'weekend', 'was in a hurry', 'shared with a friend'];

export function generate(now: Date) {
  rand = mulberry32(20261024);
  const logs: LogRow[] = [];
  let seq = 0;
  const id = () => `seed-log-${String(++seq).padStart(5, '0')}`;
  const cityRow = (c: CityId) => cities.find((x) => x.$id === c)!;
  const usersIn = (c: CityId) => seedUsers.filter((u) => u.home_city_id === c && u.activity > 0);

  const push = (o: Omit<LogRow, '$id' | 'is_seed' | 'lat' | 'lng' | 'proof_file_id' | 'note' | 'created_at'> & { days: number; note?: string | null; withProof?: boolean }) => {
    const l = localities.find((x) => x.$id === o.locality_id);
    const author = seedUsers.find((u) => u.$id === o.user_id)!;
    logs.push({
      $id: id(),
      item_id: o.item_id, locality_id: o.locality_id, city_id: o.city_id, user_id: o.user_id,
      price: o.price, price_type: o.price_type,
      ...jitter(l, cityRow(o.city_id as CityId)),
      proof_file_id: null,
      needsReceipt: o.withProof ?? (author.role === 'trusted' && o.price_type !== 'quoted' && chance(0.6)),
      note: o.note ?? (pick(NOTES) || null),
      created_at: timestamp(now, o.days),
      is_seed: true,
    });
  };

  for (const city of Object.keys(CITY_VOLUME) as CityId[]) {
    const pop = localityPopularity(city);
    const ls = localitiesByCity(city);
    const people = usersIn(city);

    for (const def of itemDefs) {
      const base = def.base[city];
      const n = Math.round(def.volume * LOGS_PER_VOLUME * CITY_VOLUME[city]);
      // The hero item: Bhopal autos are logged mostly from the busy localities, deep enough for High.
      const hero = city === 'bhopal' && def.id === 'auto-per-km';
      const hotspots = ls.filter((l) => BHOPAL_HOTSPOTS.slice(0, 7).includes(l.$id));

      for (let k = 0; k < n; k++) {
        const author = weightedPick(people, (u) => u.activity);
        let locality: Row | null = null;
        if (def.stationHeavy) {
          locality = chance(0.85) ? weightedPick(ls.filter((l) => l.kind === 'transit_hub'), (l) => pop.get(l.$id)! + 0.4) : null;
        } else if (hero && chance(0.8)) {
          locality = chance(0.8) ? pick(hotspots) : weightedPick(ls, (l) => pop.get(l.$id)!);
        } else if (chance(0.6)) {
          locality = weightedPick(ls, (l) => pop.get(l.$id)!);
        }
        const kind = locality ? (locality.kind as Kind) : null;
        const isListed = def.listed && chance(0.15);
        const factor = def.stationHeavy || !kind ? 1 : PAID_KIND_FACTOR[kind];
        push({
          item_id: def.id, city_id: city, user_id: author.$id, locality_id: locality?.$id ?? null,
          price: humanPrice(base * factor * Math.exp(0.15 * gauss())),
          price_type: isListed ? 'listed' : 'paid',
          days: ageDays(),
        });
      }

      // First quotes: ~1 in 8 logs, concentrated where newcomers get quoted.
      const nq = Math.round(n * 0.14);
      for (let k = 0; k < nq; k++) {
        const touristy = ls.filter((l) => l.kind === 'transit_hub' || l.kind === 'tourist');
        const locality = chance(0.55) ? pick(touristy) : weightedPick(ls, (l) => pop.get(l.$id)!);
        push({
          item_id: def.id, city_id: city, user_id: weightedPick(people, (u) => u.activity).$id, locality_id: locality.$id,
          price: humanPrice(base * quotedFactor(def.category, locality.kind as Kind) * Math.exp(0.08 * gauss())),
          price_type: 'quoted', days: ageDays(), note: chance(0.5) ? 'first quote, before bargaining' : null,
        });
      }
    }
  }

  // The demo scene: station autos at Rani Kamlapati (Habibganj). Deep paid data, dramatic first quotes.
  const habibganj = 'bpl-rani-kamlapati-station';
  const bhopalPeople = usersIn('bhopal');
  for (let k = 0; k < 16; k++) {
    push({ item_id: 'auto-station-to-centre', city_id: 'bhopal', locality_id: habibganj, user_id: bhopalPeople[k % bhopalPeople.length].$id,
      price: humanPrice(105 * Math.exp(0.1 * gauss())), price_type: 'paid', days: 28 * Math.pow(rand(), 1.3), note: k % 4 === 0 ? 'to MP Nagar' : null });
  }
  for (let k = 0; k < 9; k++) {
    push({ item_id: 'auto-station-to-centre', city_id: 'bhopal', locality_id: habibganj, user_id: pick(bhopalPeople).$id,
      price: humanPrice(between(240, 320)), price_type: 'quoted', days: between(0, 40), note: 'first quote at the exit gate' });
  }
  for (let k = 0; k < 6; k++) {
    push({ item_id: 'auto-per-km', city_id: 'bhopal', locality_id: habibganj, user_id: pick(bhopalPeople).$id,
      price: humanPrice(18 * between(2.2, 2.9)), price_type: 'quoted', days: between(0, 40), note: null });
  }

  // The contrast: residential areas quote close to the fair rate.
  for (const loc of ['bpl-arera-colony', 'bpl-kolar-road', 'bpl-shahpura']) {
    for (let k = 0; k < 4; k++) {
      push({ item_id: 'auto-per-km', city_id: 'bhopal', locality_id: loc, user_id: pick(bhopalPeople).$id,
        price: humanPrice(18 * between(1.0, 1.25)), price_type: 'quoted', days: between(0, 50), note: null });
    }
  }

  // Two genuinely new accounts: a handful of honest logs each, half weight.
  for (const u of seedUsers.filter((x) => x.role === 'new')) {
    const city = u.home_city_id;
    const ls = localitiesByCity(city);
    for (const def of itemDefs.slice(0, 6)) {
      const l = pick(ls);
      push({ item_id: def.id, city_id: city, locality_id: l.$id, user_id: u.$id,
        price: humanPrice(def.base[city] * Math.exp(0.12 * gauss())), price_type: 'paid', days: between(0, 12) });
    }
  }

  // Deliberate outliers for the flagging demo: recent, no confirmations, two flags each.
  const OUTLIERS: [CityId, string, string, number, string][] = [
    ['bhopal', 'auto-per-km', 'bpl-mp-nagar', 900, 'seed-u18'],
    ['bhopal', 'plumber-visit', 'bpl-arera-colony', 5, 'seed-u19'],
    ['bhopal', 'mens-haircut', 'bpl-new-market', 800, 'seed-u18'],
    ['bhopal', 'auto-station-to-centre', habibganj, 600, 'seed-u19'],
    ['indore', 'auto-per-km', 'idr-vijay-nagar', 700, 'seed-u29'],
    ['indore', 'chai', 'idr-sarafa-bazaar', 100, 'seed-u29'],
    ['indore', 'plumber-visit', 'idr-palasia', 4000, 'seed-u29'],
    ['mumbai', 'auto-per-km', 'bom-andheri-west', 1000, 'seed-u38'],
    ['mumbai', 'vada-pav', 'bom-dadar', 250, 'seed-u39'],
    ['mumbai', 'mens-haircut', 'bom-bandra-west', 5000, 'seed-u38'],
  ];
  const outlierIds: string[] = [];
  for (const [city, item, loc, price, user] of OUTLIERS) {
    push({ item_id: item, city_id: city, locality_id: loc, user_id: user, price, price_type: 'paid', days: between(1, 6), note: null, withProof: false });
    outlierIds.push(logs[logs.length - 1].$id);
  }

  // ---------- confirmations ----------
  const confirmations: Row[] = [];
  const seen = new Set<string>();
  const confirm = (log: LogRow, userId: string) => {
    const key = `${log.$id}|${userId}`;
    if (seen.has(key) || log.user_id === userId) return;
    seen.add(key);
    const logDays = (now.getTime() - new Date(log.created_at).getTime()) / DAY_MS;
    confirmations.push({ $id: `seed-cf-${String(confirmations.length + 1).padStart(5, '0')}`, log_id: log.$id, user_id: userId, city_id: log.city_id,
      created_at: timestamp(now, Math.max(0, logDays - between(0, Math.min(logDays, 5)))), is_seed: true });
  };
  const recent = logs.filter((l) => l.price_type !== 'quoted' && !outlierIds.includes(l.$id) && now.getTime() - new Date(l.created_at).getTime() < 45 * DAY_MS);
  for (const log of recent) {
    const author = seedUsers.find((u) => u.$id === log.user_id)!;
    const p = author.role === 'trusted' ? 0.28 : author.role === 'sloppy' ? 0.02 : 0.07;
    if (!chance(p)) continue;
    const pool = usersIn(log.city_id as CityId);
    const k = 1 + Math.floor(rand() * (author.role === 'trusted' ? 3 : 2));
    for (let j = 0; j < k; j++) confirm(log, pick(pool).$id);
  }
  // A few cross-city confirmations: stored, but never weighted.
  for (let j = 0; j < 6; j++) confirm(pick(recent.filter((l) => l.city_id === 'bhopal')), pick(usersIn('mumbai')).$id);

  // ---------- flags ----------
  const flags: Row[] = [];
  const REASONS: Record<number, string> = { 900: 'wrong_unit', 5: 'typo', 800: 'tourist_price', 600: 'tourist_price', 700: 'wrong_unit', 100: 'tourist_price', 4000: 'vendor_posting', 1000: 'wrong_unit', 250: 'typo', 5000: 'vendor_posting' };
  for (const logId of outlierIds) {
    const log = logs.find((l) => l.$id === logId)!;
    const flaggers = usersIn(log.city_id as CityId).filter((u) => u.$id !== log.user_id && u.role === 'regular').slice(0, 6);
    const chosen = [pick(flaggers.slice(0, 3)), pick(flaggers.slice(3))];
    for (const u of chosen) {
      flags.push({ $id: `seed-fl-${String(flags.length + 1).padStart(4, '0')}`, log_id: logId, user_id: u.$id,
        reason: REASONS[log.price] ?? 'other', created_at: timestamp(now, between(0, 1)), is_seed: true });
    }
  }
  // Sloppy accounts have a history: one honest-mistake flag on an older log.
  for (const u of seedUsers.filter((x) => x.role === 'sloppy')) {
    const theirs = logs.filter((l) => l.user_id === u.$id && !outlierIds.includes(l.$id));
    const log = theirs[0];
    if (!log) continue;
    const flagger = usersIn(u.home_city_id).find((x) => x.$id !== u.$id && x.role === 'regular')!;
    flags.push({ $id: `seed-fl-${String(flags.length + 1).padStart(4, '0')}`, log_id: log.$id, user_id: flagger.$id, reason: 'wrong_unit', created_at: timestamp(now, 3), is_seed: true });
  }

  return { logs, confirmations, flags, outlierIds };
}

// ---------- Quote Checks ----------
export interface QuoteCheckSeed { id: string; city: CityId; item: string; locality: string; quoted: number; body: string; asker: string; days: number; replies: [string, string, boolean?][] }

export const quoteChecks: QuoteCheckSeed[] = [
  { id: 'seed-qc-01', city: 'bhopal', item: 'auto-station-to-centre', locality: 'bpl-rani-kamlapati-station', quoted: 300, asker: 'seed-u19', days: 0.3,
    body: 'Just got off the Shatabdi at Rani Kamlapati. Auto guy at the gate says ₹300 to MP Nagar. Is that fair?',
    replies: [['seed-u01', 'No. ₹100–120 is normal. Walk out to the main road and ask again, they drop fast.', true], ['seed-u05', 'Paid ₹110 last week, same route.'], ['seed-u07', 'Use the prepaid booth if it is open, it is around ₹100.']] },
  { id: 'seed-qc-02', city: 'bhopal', item: 'plumber-visit', locality: 'bpl-arera-colony', quoted: 600, asker: 'seed-u12', days: 1.2,
    body: 'Plumber wants ₹600 just to come and look at a leaking tap in Arera Colony. Visit charge only, parts extra.',
    replies: [['seed-u02', 'Too high for a visit. ₹200–300 is usual here, parts extra.', true], ['seed-u09', 'Mine charged ₹250 including fixing the washer.']] },
  { id: 'seed-qc-03', city: 'bhopal', item: 'mens-haircut', locality: 'bpl-new-market', quoted: 250, asker: 'seed-u15', days: 2.5,
    body: 'New in Bhopal. Salon in New Market quoted ₹250 for a basic haircut. Normal?',
    replies: [['seed-u03', 'For a regular salon ₹80–120. ₹250 is a unisex parlour rate.'], ['seed-u01', 'Try the shops on the lane behind, ₹80 and good.', true]] },
  { id: 'seed-qc-04', city: 'bhopal', item: 'ac-service', locality: 'bpl-kolar-road', quoted: 1200, asker: 'seed-u11', days: 3.4,
    body: 'Split AC service (jet wash) at Kolar Road, technician quoting ₹1200. Is that the going rate?',
    replies: [['seed-u06', '₹450–600 for a normal service. ₹1200 only if gas refill is included.', true], ['seed-u14', 'Paid ₹550 in September.'], ['seed-u02', 'Ask whether he is counting gas. If not, ₹600 max.']] },
  { id: 'seed-qc-05', city: 'bhopal', item: 'auto-per-km', locality: 'bpl-bhopal-junction-station', quoted: 45, asker: 'seed-u16', days: 4.1,
    body: 'Auto at Bhopal Junction asking ₹45 per km to Kolar. Meters never used here?',
    replies: [['seed-u04', 'Nobody uses the meter. Fix the total before sitting. ₹18–20 per km works out right.']] },
  { id: 'seed-qc-06', city: 'bhopal', item: 'thali-local', locality: 'bpl-mp-nagar', quoted: 180, asker: 'seed-u13', days: 6,
    body: 'Thali near MP Nagar Zone 1 for ₹180, unlimited roti. Fair or tourist pricing?',
    replies: [['seed-u08', 'Fair for unlimited. Fixed thalis are ₹100–130.'], ['seed-u10', 'Same place, ₹160 last month.']] },
  { id: 'seed-qc-07', city: 'bhopal', item: 'electrician-visit', locality: 'bpl-shahpura', quoted: 350, asker: 'seed-u20', days: 8.5,
    body: 'Electrician wants ₹350 to change two switchboards in Shahpura. Labour only.',
    replies: [['seed-u05', 'Reasonable for two boards. Visit alone is ~₹200.', true]] },
  { id: 'seed-qc-08', city: 'bhopal', item: 'house-cleaning-2bhk', locality: 'bpl-ayodhya-bypass', quoted: 3500, asker: 'seed-u17', days: 11,
    body: 'Deep cleaning for a 2BHK before moving in, quote is ₹3500. Seems steep for Bhopal.',
    replies: [['seed-u01', '₹1600–2200 is normal. ₹3500 is app pricing.', true], ['seed-u12', 'Got it done for ₹1800, kitchen included.'], ['seed-u07', 'Ask for a per-room rate, it usually comes lower.'], ['seed-u03', 'Agree, ₹2000 max.']] },
  { id: 'seed-qc-09', city: 'indore', item: 'auto-station-to-centre', locality: 'idr-indore-junction-station', quoted: 300, asker: 'seed-u24', days: 0.8,
    body: 'Indore Junction to Vijay Nagar, auto asking ₹300. How much should I pay?',
    replies: [['seed-u21', '₹120–150. Or take the iBus from Rajiv Gandhi square.', true], ['seed-u26', 'Paid ₹140 two days ago.']] },
  { id: 'seed-qc-10', city: 'indore', item: 'poha-jalebi', locality: 'idr-sarafa-bazaar', quoted: 80, asker: 'seed-u27', days: 2,
    body: 'Poha-jalebi at Sarafa for ₹80 a plate. Tourist price?',
    replies: [['seed-u22', 'Sarafa is a bit pricey at night. ₹30–40 anywhere in the morning.']] },
  { id: 'seed-qc-11', city: 'indore', item: 'ro-service', locality: 'idr-vijay-nagar', quoted: 900, asker: 'seed-u25', days: 5,
    body: 'RO service with filter change for ₹900 in Vijay Nagar?',
    replies: [['seed-u23', 'Filter change makes it more. ₹400 for service, ₹800–1000 with all filters.', true], ['seed-u30', 'Fair if all three filters are new.']] },
  { id: 'seed-qc-12', city: 'indore', item: 'mens-haircut-beard', locality: 'idr-palasia', quoted: 200, asker: 'seed-u28', days: 9,
    body: 'Haircut + beard in Palasia, ₹200. Is that standard?',
    replies: [['seed-u21', 'Little high. ₹120–150 normally.']] },
  { id: 'seed-qc-13', city: 'mumbai', item: 'auto-per-km', locality: 'bom-andheri-station', quoted: 40, asker: 'seed-u39', days: 1,
    body: 'Auto at Andheri station refusing meter, wants ₹40 per km to Powai. Normal in Mumbai?',
    replies: [['seed-u31', 'No, insist on the meter. It comes to about ₹18 per km.', true], ['seed-u34', 'Walk 100 m away from the station exit, they will use the meter.']] },
  { id: 'seed-qc-14', city: 'mumbai', item: 'vada-pav', locality: 'bom-dadar', quoted: 40, asker: 'seed-u33', days: 4,
    body: 'Vada pav near Dadar station for ₹40?',
    replies: [['seed-u32', '₹15–20 at the stalls. ₹40 only at the fancy chains.']] },
  { id: 'seed-qc-15', city: 'mumbai', item: 'plumber-visit', locality: 'bom-powai', quoted: 800, asker: 'seed-u36', days: 10,
    body: 'Plumber in Powai charging ₹800 for a visit plus the work. Too much?',
    replies: [['seed-u35', '₹400–500 for a visit is normal in Powai.', true], ['seed-u40', 'Society plumber charged me ₹450.'], ['seed-u31', 'Agree, ₹500 max.']] },
];

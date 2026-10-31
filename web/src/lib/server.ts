import 'server-only';
import { cookies } from 'next/headers';
import { Query } from 'appwrite';
import { buildCard, stateIdOf } from '../core/card.js';
import { DB, ENDPOINT, PROJECT_ID } from './appwrite';
import { splitRecent } from './recentPrices';
import type { Card, Category, City, Item, Locality, PriceLog, PriceStat, QuoteCheck, Reply, UserRow } from './types';

// Server-side reads: plain REST calls so Next's fetch cache can hold reference data.
// Everything read here is public (read("any")), so no API key is involved.

async function rest<T>(tableId: string, queries: string[], revalidate: number): Promise<T[]> {
  const qs = queries.map((q) => `queries[]=${encodeURIComponent(q)}`).join('&');
  const res = await fetch(`${ENDPOINT}/tablesdb/${DB}/tables/${tableId}/rows?${qs}`, {
    headers: { 'X-Appwrite-Project': PROJECT_ID },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`${tableId}: HTTP ${res.status}`);
  return ((await res.json()) as { rows: T[] }).rows;
}

export interface RefData { cities: City[]; localities: Locality[]; categories: Category[]; items: Item[] }

/** Reference data changes only on re-seed: cached for 10 minutes across requests. */
export async function getRefData(): Promise<RefData> {
  const all = [Query.limit(500)];
  const [cities, localities, categories, items] = await Promise.all([
    rest<City>('cities', all, 600),
    rest<Locality>('localities', all, 600),
    rest<Category>('categories', all, 600),
    rest<Item>('items', all, 600),
  ]);
  return {
    cities: cities.sort((a, b) => a.name.localeCompare(b.name)),
    localities: localities.sort((a, b) => a.name.localeCompare(b.name)),
    categories,
    items,
  };
}

export const PLACE_COOKIE = 'so_place';

/** The user's place, mirrored into a cookie so the first paint is already for the right area. */
export async function getPlaceCookie(): Promise<{ cityId: string; localityId: string | null } | null> {
  const raw = (await cookies()).get(PLACE_COOKIE)?.value;
  if (!raw) return null;
  const [cityId, localityId] = decodeURIComponent(raw).split('|');
  return cityId ? { cityId, localityId: localityId || null } : null;
}

/** Stats change at most hourly (plus on-demand runs): a 60 s cache is fresh enough. */
export async function getCard(ref: RefData, itemId: string, cityId: string, localityId: string | null) {
  const item = ref.items.find((i) => i.$id === itemId);
  const city = ref.cities.find((c) => c.$id === cityId);
  if (!item || !city) return null;
  const locality = localityId ? (ref.localities.find((l) => l.$id === localityId && l.city_id === city.$id) ?? null) : null;
  const category = ref.categories.find((c) => c.$id === item.category_id);
  const scopeIds = [city.$id, stateIdOf(city), ...(locality ? [locality.$id] : [])];
  const rows = await rest<PriceStat>('price_stats', [Query.equal('item_id', item.$id), Query.equal('scope_id', scopeIds), Query.limit(10)], 30);
  const card = buildCard({ item, hyperlocal: category?.hyperlocal ?? true, city, locality, rows }) as Card;
  return { card, item, city, locality, fetchedAt: new Date().toISOString() };
}

export async function getCityStats(cityIds: string[]) {
  return rest<PriceStat>('price_stats', [Query.equal('scope_type', 'city'), Query.equal('scope_id', cityIds), Query.limit(200)], 30);
}

/** The newest questions in a city (the Feed's first tab), with their askers, for the server-rendered first paint. */
export async function getQuestions(cityId: string) {
  const qcs = await rest<QuoteCheck>('quote_checks', [Query.equal('city_id', cityId), Query.orderDesc('created_at'), Query.limit(30)], LOGS_CACHE);
  const ids = [...new Set(qcs.map((q) => q.user_id))];
  const users = await getUsersFor(ids);
  return { qcs, users };
}

export const GUIDE_COOKIE = 'so_guide';
export async function getGuideDismissed() {
  return (await cookies()).has(GUIDE_COOKIE);
}

// Volatile data (prices people just saved) is cached only briefly on the server, and the page revalidates it
// in the browser right after it loads, so a price you just saved never hides behind this cache.
const LOGS_CACHE = 20;

/** The latest 5 paid/listed prices plus up to 3 first quotes, so quotes never sit unexplained among fair prices. */
export async function getLogs(itemId: string, cityId: string, localityId: string | null) {
  const q = [Query.equal('city_id', cityId), Query.equal('item_id', itemId), Query.orderDesc('created_at'), Query.limit(24)];
  if (localityId) q.push(Query.equal('locality_id', localityId));
  return splitRecent(await rest<PriceLog>('price_logs', q, LOGS_CACHE));
}

export async function getUsersFor(userIds: string[]) {
  const ids = [...new Set(userIds)];
  return ids.length ? rest<UserRow>('users', [Query.equal('$id', ids), Query.limit(100)], 120) : [];
}

/** One question with its answers and everyone involved, for the server-rendered first paint of /q/[id]. */
export async function getQuestion(id: string) {
  const [qcs, replies] = await Promise.all([
    rest<QuoteCheck>('quote_checks', [Query.equal('$id', id), Query.limit(1)], LOGS_CACHE),
    rest<Reply>('replies', [Query.equal('quote_check_id', id), Query.orderAsc('created_at'), Query.limit(100)], LOGS_CACHE),
  ]);
  const qc = qcs[0];
  if (!qc) return null;
  const users = await getUsersFor([qc.user_id, ...replies.map((r) => r.user_id)]);
  return { qc, replies, users };
}

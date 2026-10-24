import { Query } from 'appwrite';
import { buildCard, stateIdOf } from '../core/card.js';
import { getRow, listRows } from './appwrite';
import { splitRecent } from './recentPrices';
import { load, save } from './storage';
import type { Card, Category, City, Item, Locality, PriceLog, PriceStat, QuoteCheck, Reply, UserRow } from './types';

// ---------- fair-range card ----------

export interface CardResult { card: Card; fetchedAt: string; stale: boolean }

/** Reads ≤ 3 price_stats rows (locality, city, state) and builds the card. Falls back to the last saved card offline. */
export async function fetchCard(item: Item, category: Category | undefined, city: City, locality: Locality | null | undefined): Promise<CardResult> {
  const key = `so.card.${item.$id}.${city.$id}.${locality?.$id ?? '-'}`;
  try {
    const scopeIds = [city.$id, stateIdOf(city), ...(locality ? [locality.$id] : [])];
    const rows = await listRows<PriceStat>('price_stats', [Query.equal('item_id', item.$id), Query.equal('scope_id', scopeIds), Query.limit(10)]);
    const card = buildCard({ item, hyperlocal: category?.hyperlocal ?? true, city, locality: locality ?? null, rows }) as Card;
    const result = { card, fetchedAt: new Date().toISOString(), stale: false };
    save(key, result);
    return result;
  } catch (e) {
    const cached = load<CardResult | null>(key, null);
    if (cached) return { ...cached, stale: true };
    throw e;
  }
}

/** City-scope stats for every item in one query, for the home grid and compare. */
export async function fetchCityStats(cityIds: string[]) {
  return listRows<PriceStat>('price_stats', [Query.equal('scope_type', 'city'), Query.equal('scope_id', cityIds), Query.limit(200)]);
}

// ---------- logs, quote checks, people ----------

export async function fetchRecentLogs(p: { itemId?: string; cityId: string; localityId?: string | null; limit?: number; includeQuoted?: boolean }) {
  const q = [Query.equal('city_id', p.cityId), Query.orderDesc('created_at'), Query.limit(p.limit ?? 5)];
  if (p.itemId) q.push(Query.equal('item_id', p.itemId));
  if (p.localityId) q.push(Query.equal('locality_id', p.localityId));
  if (p.includeQuoted === false) q.push(Query.notEqual('price_type', 'quoted'));
  return listRows<PriceLog>('price_logs', q);
}

/** Recent paid/listed prices plus a few first quotes for one item and place. */
export async function fetchRecentPrices(p: { itemId: string; cityId: string; localityId?: string | null }) {
  return splitRecent(await fetchRecentLogs({ ...p, limit: 24 }));
}

export async function fetchUserLogs(userId: string, limit = 20) {
  return listRows<PriceLog>('price_logs', [Query.equal('user_id', userId), Query.orderDesc('created_at'), Query.limit(limit)]);
}

export async function fetchQuoteChecks(cityId: string, limit = 30) {
  return listRows<QuoteCheck>('quote_checks', [Query.equal('city_id', cityId), Query.orderDesc('created_at'), Query.limit(limit)]);
}

export const fetchQuoteCheck = (id: string) => getRow<QuoteCheck>('quote_checks', id);

export async function fetchReplies(quoteCheckId: string) {
  return listRows<Reply>('replies', [Query.equal('quote_check_id', quoteCheckId), Query.orderAsc('created_at'), Query.limit(100)]);
}

const userCache = new Map<string, UserRow>();

export async function fetchUsers(ids: string[]): Promise<Map<string, UserRow>> {
  const missing = [...new Set(ids)].filter((id) => id && !userCache.has(id));
  for (let i = 0; i < missing.length; i += 100) {
    const rows = await listRows<UserRow>('users', [Query.equal('$id', missing.slice(i, i + 100)), Query.limit(100)]);
    rows.forEach((u) => userCache.set(u.$id, u));
  }
  return new Map(ids.filter((id) => userCache.has(id)).map((id) => [id, userCache.get(id)!]));
}

export async function fetchUser(id: string) {
  const u = await getRow<UserRow>('users', id);
  userCache.set(u.$id, u);
  return u;
}

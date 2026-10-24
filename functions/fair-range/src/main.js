import { Client, TablesDB, Query } from 'node-appwrite';
import { buildCard, stateIdOf } from './core/card.js';
import { resolveLocation } from './core/geo.js';

// GET /?item=<slug>&lat=&lng=   (or &locality=<id> / &city=<id> instead of coordinates)
// Public, read-only, returns exactly what the fair-range card shows.

const DB = 'main';
const REF_TTL_MS = 10 * 60_000;
const RATE_LIMIT = 60; // requests per minute per IP, best effort per warm container
const VERSION = '0.1.0';

let ref = null;
let refAt = 0;
const hits = new Map();

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=60',
};

export default async ({ req, res, error }) => {
  const send = (body, status = 200, extra = {}) => res.json({ ...body, api: { name: 'second-opinion/fair-range', version: VERSION, demoData: true } }, status, { ...HEADERS, ...extra });
  if (req.method === 'OPTIONS') return res.empty();
  if (req.method !== 'GET') return send({ error: 'method_not_allowed', message: 'Use GET.' }, 405);

  const ip = String(req.headers['x-forwarded-for'] ?? 'unknown').split(',')[0].trim();
  const minute = Math.floor(Date.now() / 60_000);
  const key = `${ip}|${minute}`;
  hits.set(key, (hits.get(key) ?? 0) + 1);
  if (hits.size > 5000) hits.clear();
  if (hits.get(key) > RATE_LIMIT) return send({ error: 'rate_limited', message: `Max ${RATE_LIMIT} requests per minute.` }, 429, { 'Retry-After': '60' });

  const db = new TablesDB(
    new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(req.headers['x-appwrite-key']),
  );

  try {
    const r = await loadRef(db);
    // The runtime hands query values over still URL-encoded ("tuk%20tuk").
    const q = Object.fromEntries(Object.entries(req.query ?? {}).map(([k, v]) => [k, safeDecode(v)]));

    if (!q.item) {
      return send({
        usage: 'GET ?item=<slug>&lat=<lat>&lng=<lng>  (or &locality=<id>, or &city=<id>)',
        example: '?item=auto-station-to-centre&lat=23.2223&lng=77.4380',
        items: r.items.map((i) => ({ slug: i.slug, name: i.name, unit: i.unit })),
        cities: r.cities.map((c) => ({ id: c.$id, name: c.name, lat: c.lat, lng: c.lng })),
      });
    }

    const item = r.items.find((i) => i.slug === q.item) ?? r.items.find((i) => i.aliases?.some((a) => a.toLowerCase() === String(q.item).toLowerCase()));
    if (!item) {
      const needle = String(q.item).toLowerCase();
      const suggestions = r.items.filter((i) => i.slug.includes(needle) || i.name.toLowerCase().includes(needle) || i.aliases?.some((a) => a.includes(needle))).map((i) => i.slug);
      return send({ error: 'unknown_item', message: `No item "${q.item}".`, suggestions }, 404);
    }

    let city = null;
    let locality = null;
    let resolvedBy;
    if (q.lat != null && q.lng != null) {
      const lat = Number(q.lat);
      const lng = Number(q.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return send({ error: 'bad_coordinates', message: 'lat and lng must be numbers.' }, 400);
      ({ city, locality } = resolveLocation(lat, lng, r.cities, r.localities));
      resolvedBy = 'coordinates';
    } else if (q.locality) {
      locality = r.localities.find((l) => l.$id === q.locality) ?? null;
      city = locality ? r.cities.find((c) => c.$id === locality.city_id) : null;
      resolvedBy = 'locality';
    } else if (q.city) {
      city = r.cities.find((c) => c.$id === q.city || c.slug === q.city) ?? null;
      resolvedBy = 'city';
    } else {
      return send({ error: 'missing_location', message: 'Pass lat & lng, or locality, or city.' }, 400);
    }
    if (!city) {
      return send({ error: 'outside_coverage', message: 'Second Opinion covers Bhopal, Indore and Mumbai for now.', cities: r.cities.map((c) => c.$id) }, 422);
    }

    const scopeIds = [city.$id, stateIdOf(city), ...(locality ? [locality.$id] : [])];
    const { rows } = await db.listRows({
      databaseId: DB,
      tableId: 'price_stats',
      queries: [Query.equal('item_id', item.$id), Query.equal('scope_id', scopeIds), Query.limit(10)],
    });

    const category = r.categories.find((c) => c.$id === item.category_id);
    const card = buildCard({ item, hyperlocal: category?.hyperlocal ?? true, city, locality, rows });
    return send({ ...card, resolvedBy }, card.status === 'ok' ? 200 : 404);
  } catch (e) {
    error(e?.stack ?? String(e));
    return send({ error: 'internal', message: 'Something went wrong on our side. Try again in a moment.' }, 500);
  }
};

function safeDecode(v) {
  try {
    return decodeURIComponent(String(v).replace(/\+/g, ' '));
  } catch {
    return String(v);
  }
}

async function loadRef(db) {
  if (ref && Date.now() - refAt < REF_TTL_MS) return ref;
  const list = async (tableId) => (await db.listRows({ databaseId: DB, tableId, queries: [Query.limit(500)] })).rows;
  const [cities, localities, categories, items] = await Promise.all(['cities', 'localities', 'categories', 'items'].map(list));
  ref = { cities, localities, categories, items };
  refAt = Date.now();
  return ref;
}

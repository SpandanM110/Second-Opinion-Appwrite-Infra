import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAll, weightedQuantiles, reputation, logWeight, confidenceFor } from './engine.js';
import { buildCard } from './card.js';
import { resolveLocation, haversineKm } from './geo.js';
import { checkPrice, cleanName, cleanText } from './rules.js';

const NOW = new Date('2026-10-24T12:00:00Z');
const daysAgo = (d) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const cities = [{ $id: 'bhopal', name: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lng: 77.4126 }];

let seq = 0;
const log = (over = {}) => ({
  $id: `l${++seq}`, item_id: 'auto', locality_id: 'mp-nagar', city_id: 'bhopal', user_id: 'u1',
  price: 100, price_type: 'paid', proof_file_id: null, created_at: daysAgo(1),
  confirm_count: 0, flag_count: 0, hidden: false, ...over,
});

test('weighted median follows the heavier side', () => {
  const [m] = weightedQuantiles([{ price: 100, w: 1 }, { price: 200, w: 3 }], [0.5]);
  assert.ok(m > 150, `median ${m} should lean to 200`);
  assert.equal(weightedQuantiles([{ price: 50, w: 1 }], [0.5])[0], 50);
});

test('reputation clamps to 0.2..3.0', () => {
  assert.equal(reputation(0, 0), 1);
  assert.equal(reputation(100, 0), 3);
  assert.equal(reputation(0, 10), 0.2);
});

test('log weight: trusted local with receipt ≈ 4x+ a fresh account', () => {
  const trusted = logWeight({ reputation: 3, ageDays: 0, authorLogCount: 50, hasProof: true, sameCityConfirms: 0 });
  const fresh = logWeight({ reputation: 1, ageDays: 0, authorLogCount: 1, hasProof: false, sameCityConfirms: 0 });
  assert.equal(trusted / fresh, 12);
});

test('confidence thresholds', () => {
  assert.equal(confidenceFor({ nWeighted: 20, distinctUsers: 5, spread: 1.3, newestAgeDays: 2 }), 'high');
  assert.equal(confidenceFor({ nWeighted: 20, distinctUsers: 5, spread: 1.8, newestAgeDays: 2 }), 'medium');
  assert.equal(confidenceFor({ nWeighted: 4, distinctUsers: 5, spread: 1.1, newestAgeDays: 2 }), 'low');
});

test('three distinct flags hide a log; self-flags and self-confirms are ignored', () => {
  const bad = log({ price: 900, user_id: 'vendor' });
  const good = [log(), log({ user_id: 'u2' }), log({ user_id: 'u3', price: 110 })];
  const flags = ['u1', 'u2', 'vendor', 'u3'].map((u) => ({ log_id: bad.$id, user_id: u }));
  const confirmations = [{ log_id: good[0].$id, user_id: 'u1', city_id: 'bhopal' }];
  const users = ['u1', 'u2', 'u3', 'vendor'].map(($id) => ({ $id, reputation: 1 }));
  const { logPatches, stats, userPatches } = computeAll({ logs: [bad, ...good], users, confirmations, flags, cities, now: NOW });

  assert.deepEqual(logPatches.find((p) => p.id === bad.$id), { id: bad.$id, confirm_count: 0, flag_count: 3, hidden: true });
  assert.equal(logPatches.find((p) => p.id === good[0].$id), undefined, 'self-confirm must not count');
  const city = stats.find((s) => s.scope_type === 'city');
  assert.equal(city.n_raw, 3, 'hidden log excluded');
  assert.ok(city.p90 <= 110);
  // 3 flags from others (self-flag ignored): 1 - 0.9 = 0.1, clamped to the 0.2 floor
  assert.equal(userPatches.find((p) => p.id === 'vendor').reputation, 0.2);
});

test('quoted logs feed only the overcharge index', () => {
  const logs = [
    ...[100, 100, 110].map((price, i) => log({ price, user_id: `p${i}` })),
    ...[260, 280, 300].map((price, i) => log({ price, price_type: 'quoted', user_id: `q${i}` })),
  ];
  const { stats } = computeAll({ logs, users: [], confirmations: [], flags: [], cities, now: NOW });
  const loc = stats.find((s) => s.scope_type === 'locality');
  assert.equal(loc.n_raw, 3);
  assert.equal(loc.overcharge_index, 2.8);
  assert.equal(stats.find((s) => s.scope_type === 'state').scope_id, 'madhya-pradesh');
});

test('logs outside 90 days are excluded', () => {
  const { stats } = computeAll({ logs: [log({ created_at: daysAgo(91) })], users: [], confirmations: [], flags: [], cities, now: NOW });
  assert.equal(stats.length, 0);
});

const item = { $id: 'auto', name: 'Auto ride', unit: 'per_km' };
const city = cities[0];
const locality = { $id: 'mp-nagar', name: 'MP Nagar', city_id: 'bhopal' };
const row = (over) => ({
  scope_type: 'city', scope_id: 'bhopal', median: 18, p10: 14, p25: 16, p75: 20, p90: 24,
  n_weighted: 20, n_raw: 30, distinct_users: 9, confidence: 'high',
  newest_log_at: daysAgo(1), oldest_log_at: daysAgo(40), overcharge_index: null, computed_at: NOW.toISOString(), ...over,
});

test('card uses locality when it has ≥5 weighted logs', () => {
  const card = buildCard({ item, hyperlocal: true, city, locality, rows: [row({ scope_type: 'locality', scope_id: 'mp-nagar' }), row()], now: NOW });
  assert.equal(card.scope.type, 'locality');
  assert.equal(card.scope.label, 'in MP Nagar');
  assert.equal(card.confidence.level, 'high');
  assert.equal(card.sample.line, '30 prices from 9 people in the last 40 days');
});

test('thin locality falls back to city and caps High at Medium', () => {
  const card = buildCard({ item, hyperlocal: true, city, locality, rows: [row({ scope_type: 'locality', scope_id: 'mp-nagar', n_weighted: 2 }), row()], now: NOW });
  assert.equal(card.scope.type, 'city');
  assert.equal(card.scope.label, 'city-wide · not enough local data');
  assert.equal(card.confidence.level, 'medium');
});

test('overcharge comes from the locality only, even when the card falls back', () => {
  const rows = [row({ scope_type: 'locality', scope_id: 'mp-nagar', n_weighted: 2, overcharge_index: 2.6 }), row({ overcharge_index: 2.5 })];
  assert.equal(buildCard({ item, hyperlocal: true, city, locality, rows, now: NOW }).overcharge.index, 2.6);
  assert.equal(buildCard({ item, hyperlocal: true, city, locality: null, rows, now: NOW }).overcharge, null);
});

test('non-hyperlocal items start at city scope without a fallback cap', () => {
  const card = buildCard({ item, hyperlocal: false, city, locality, rows: [row({ scope_type: 'locality', scope_id: 'mp-nagar' }), row()], now: NOW });
  assert.equal(card.scope.type, 'city');
  assert.equal(card.scope.label, 'across Bhopal');
  assert.equal(card.confidence.level, 'high');
});

test('no rows → no_data; thin rows → Low rough guide', () => {
  assert.equal(buildCard({ item, hyperlocal: true, city, locality, rows: [], now: NOW }).status, 'no_data');
  const thin = buildCard({ item, hyperlocal: true, city, locality, rows: [row({ n_weighted: 2, n_raw: 3, confidence: 'low' })], now: NOW });
  assert.equal(thin.confidence.level, 'low');
  assert.equal(thin.confidence.reason, 'only 3 prices so far');
});

test('geo: snaps to locality within 3 km, else city only', () => {
  const locs = [{ ...locality, lat: 23.2332, lng: 77.4343 }];
  assert.equal(resolveLocation(23.234, 77.435, cities, locs).locality.$id, 'mp-nagar');
  assert.equal(resolveLocation(23.30, 77.34, cities, locs).locality, null);
  assert.equal(resolveLocation(19.07, 72.87, cities, locs).city, null);
  assert.ok(Math.abs(haversineKm(23.2599, 77.4126, 22.7196, 75.8577) - 168) < 5);
});

test('price sanity bounds reject typos but accept honest quotes', () => {
  const auto = { name: 'Auto ride', unit: 'per_km', typical_min: 5, typical_max: 72 };
  assert.deepEqual(checkPrice(auto, 18), { ok: true });
  assert.deepEqual(checkPrice(auto, 55), { ok: true }, 'a 3x first quote is plausible');
  assert.equal(checkPrice(auto, 900).code, 'too_high');
  assert.match(checkPrice(auto, 900).message, /per km/);
  assert.equal(checkPrice(auto, 2).code, 'too_low');
  assert.equal(checkPrice(auto, 12.5).code, 'bad_price');
  assert.equal(checkPrice(auto, 0).code, 'bad_price');
  assert.equal(checkPrice(auto, NaN).code, 'bad_price');
});

test('text cleaning: control characters, whitespace, lengths and display names', () => {
  assert.equal(cleanText('  a\u0000b\n\n c  ', 10), 'a b c');
  assert.equal(cleanText('x'.repeat(500), 140).length, 140);
  assert.equal(cleanName('Arjun K.'), 'Arjun K.');
  assert.equal(cleanName('<script>alert(1)</script>'), 'scriptalert1script');
  assert.equal(cleanName('  Priya   Sharma  '), 'Priya Sharma');
  assert.equal(cleanName('राहुल शर्मा'), 'राहुल शर्मा');
});

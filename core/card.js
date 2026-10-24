// Fair-range card model: picks the scope to show, applies the fallback cap and
// writes every label. Shared by the web card and the /fair-range endpoint so the
// two can never disagree.

import { MIN_SCOPE_WEIGHT, WINDOW_DAYS, slugify } from './engine.js';

const DAY_MS = 86_400_000;

export const UNIT_LABEL = {
  per_km: 'per km',
  per_visit: 'per visit',
  per_hour: 'per hour',
  per_day: 'per day',
  per_plate: 'per plate',
  each: 'each',
};

export const PRICE_TYPE_HELP = {
  paid: 'what you handed over',
  quoted: 'what you were asked first',
  listed: 'on a board or menu',
};

export const stateIdOf = (city) => slugify(city.state);

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function sampleLine(row, now = new Date()) {
  const days = Math.max(1, Math.ceil((now - new Date(row.oldest_log_at ?? row.newest_log_at)) / DAY_MS));
  return `${plural(row.n_raw, 'price')} from ${plural(row.distinct_users, 'person', 'people')} in the last ${Math.min(days, WINDOW_DAYS)} days`;
}

/** One-line, plain-language reason for the badge ("only 4 prices so far"). */
export function confidenceReason(row, level, now = new Date()) {
  if (level === 'high') return sampleLine(row, now);
  const newestDays = Math.floor((now - new Date(row.newest_log_at)) / DAY_MS);
  const spread = row.p25 > 0 ? row.p75 / row.p25 : Infinity;
  if (row.n_weighted < MIN_SCOPE_WEIGHT) return `only ${plural(row.n_raw, 'price')} so far`;
  if (row.distinct_users < 2) return 'only one person has logged this';
  if (row.distinct_users < 3 && level === 'medium') return `only ${row.distinct_users} people have logged this`;
  if (spread > 1.5) return 'prices vary a lot here';
  if (newestDays > 30) return `newest price is ${newestDays} days old`;
  if (row.n_weighted < 15) return `${plural(row.n_raw, 'price')} so far, more will tighten it`;
  return sampleLine(row, now);
}

export function overchargeLine(index) {
  if (index == null || index < 1.2) return null;
  return `first quotes here average ${index.toFixed(1)}x the fair price`;
}

/**
 * Build the card for one item at one place.
 * @param {object} p
 * @param {object} p.item       items row (+ unit)
 * @param {boolean} p.hyperlocal category flag: hyperlocal items try locality first
 * @param {object} p.city       cities row
 * @param {object|null} p.locality localities row, or null when unknown
 * @param {Array} p.rows        price_stats rows for this item (any of locality / city / state scope)
 */
export function buildCard({ item, hyperlocal, city, locality, rows, now = new Date() }) {
  const find = (type, id) => rows.find((r) => r.scope_type === type && r.scope_id === id) ?? null;
  const localityRow = locality ? find('locality', locality.$id) : null;
  const cityRow = find('city', city.$id);
  const stateRow = find('state', stateIdOf(city));

  const candidates = [];
  if (locality && hyperlocal) candidates.push({ type: 'locality', row: localityRow });
  candidates.push({ type: 'city', row: cityRow }, { type: 'state', row: stateRow });

  let pickIndex = candidates.findIndex((c) => c.row && c.row.n_weighted >= MIN_SCOPE_WEIGHT);
  let thin = false;
  if (pickIndex === -1) {
    // Nothing reaches 5 weighted logs. Show the best thin scope as Low rather than hide real data,
    // but only if at least two logs back it; a single log is never shown as a range.
    const best = candidates
      .map((c, i) => ({ ...c, i }))
      .filter((c) => c.row && c.row.n_raw >= 2)
      .sort((a, b) => b.row.n_weighted - a.row.n_weighted)[0];
    if (!best) {
      return {
        status: 'no_data',
        item: itemView(item),
        place: placeView(city, locality),
        message: `No one has logged this in ${city.name} yet. Be the first.`,
      };
    }
    pickIndex = best.i;
    thin = true;
  }

  const { type, row } = candidates[pickIndex];
  const fellBack = pickIndex > 0;
  let level = thin ? 'low' : row.confidence;
  if (fellBack && level === 'high') level = 'medium'; // a fallback never looks hyperlocal

  // Locality only (F5). City-wide quotes cluster at stations, so a city index would overstate it.
  const overcharge = localityRow?.overcharge_index ?? null;

  return {
    status: 'ok',
    item: itemView(item),
    place: placeView(city, locality),
    scope: {
      type,
      id: row.scope_id,
      fallback: fellBack,
      label: scopeLabel(type, { city, locality, fellBack, hyperlocal }),
    },
    range: { median: row.median, p25: row.p25, p75: row.p75, p10: row.p10, p90: row.p90 },
    confidence: { level, reason: confidenceReason(row, level, now), roughGuide: level === 'low' },
    sample: {
      logs: row.n_raw,
      people: row.distinct_users,
      weighted: row.n_weighted,
      newestLogAt: row.newest_log_at,
      line: sampleLine(row, now),
    },
    overcharge: overcharge != null && overcharge >= 1.2 ? { index: overcharge, line: overchargeLine(overcharge) } : null,
    computedAt: row.computed_at,
    statsId: row.$id ?? null,
  };
}

function scopeLabel(type, { city, locality, fellBack, hyperlocal }) {
  if (type === 'locality') return `in ${locality.name}`;
  if (type === 'city') {
    if (fellBack && locality && hyperlocal) return 'city-wide · not enough local data';
    return `across ${city.name}`;
  }
  return `state-wide estimate · ${city.state}`;
}

const itemView = (item) => ({ id: item.$id, name: item.name, unit: item.unit, unitLabel: UNIT_LABEL[item.unit] });
const placeView = (city, locality) => ({
  city: { id: city.$id, name: city.name },
  locality: locality ? { id: locality.$id, name: locality.name } : null,
});

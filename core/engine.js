// Stats engine: turns raw price_logs into price_stats rows, log counters and reputations.
// Pure and deterministic (no I/O), so the compute-stats Function and the seed dry run share it.
// Every rule here is from "Trust and verification design" in the build plan.

export const WINDOW_DAYS = 90;
export const DECAY_DAYS = 45; // w ∝ e^(-d/45), half-life ≈ 31 days
export const MIN_SCOPE_WEIGHT = 5;
export const HIDE_AT_FLAGS = 3;
export const NEW_USER_LOGS = 10;
export const CONFIRM_BONUS = 0.5;
export const OVERCHARGE_MIN_EACH = 3;

const DAY_MS = 86_400_000;
const RANGE_TYPES = new Set(['paid', 'listed']);

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round2 = (x) => Math.round(x * 100) / 100;

export const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function reputation(confirmationsReceived, flagsReceived) {
  return round2(clamp(1 + 0.1 * confirmationsReceived - 0.3 * flagsReceived, 0.2, 3.0));
}

export function logWeight({ reputation: r, ageDays, authorLogCount, hasProof, sameCityConfirms }) {
  const n = authorLogCount < NEW_USER_LOGS ? 0.5 : 1;
  const p = hasProof ? 2 : 1;
  return r * Math.exp(-Math.max(0, ageDays) / DECAY_DAYS) * n * p + CONFIRM_BONUS * sameCityConfirms;
}

// Weighted quantiles with midpoint interpolation: each log owns a slice of the
// cumulative weight, so a heavy log pulls the median towards itself smoothly.
export function weightedQuantiles(points, qs) {
  const sorted = points.filter((p) => p.w > 0).sort((a, b) => a.price - b.price);
  if (sorted.length === 0) return qs.map(() => null);
  const total = sorted.reduce((s, p) => s + p.w, 0);
  let cum = 0;
  const pos = sorted.map((p) => {
    const c = (cum + p.w / 2) / total;
    cum += p.w;
    return c;
  });
  return qs.map((q) => {
    if (q <= pos[0]) return sorted[0].price;
    if (q >= pos[pos.length - 1]) return sorted[sorted.length - 1].price;
    const i = pos.findIndex((c) => c >= q);
    const t = (q - pos[i - 1]) / (pos[i] - pos[i - 1]);
    return sorted[i - 1].price + t * (sorted[i].price - sorted[i - 1].price);
  });
}

export function median(nums) {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function confidenceFor({ nWeighted, distinctUsers, spread, newestAgeDays }) {
  if (nWeighted >= 15 && distinctUsers >= 3 && spread <= 1.5 && newestAgeDays <= 30) return 'high';
  if (nWeighted >= MIN_SCOPE_WEIGHT && distinctUsers >= 2 && spread <= 2.5 && newestAgeDays <= WINDOW_DAYS) return 'medium';
  return 'low';
}

/**
 * @param {object} input
 * @param {Array} input.logs          price_logs rows ($id, item_id, locality_id, city_id, user_id, price, price_type, proof_file_id, created_at, confirm_count, flag_count, hidden)
 * @param {Array} input.users         users rows ($id, reputation, log_count, confirmations_received, flags_received)
 * @param {Array} input.confirmations confirmations rows (log_id, user_id, city_id)
 * @param {Array} input.flags         flags rows (log_id, user_id)
 * @param {Array} input.cities        cities rows ($id, state)
 * @param {Date}  [input.now]
 * @returns {{ stats: Array, logPatches: Array, userPatches: Array }}
 */
export function computeAll({ logs, users, confirmations, flags, cities, now = new Date() }) {
  const nowMs = now.getTime();
  const logById = new Map(logs.map((l) => [l.$id, l]));
  const stateOfCity = new Map(cities.map((c) => [c.$id, slugify(c.state)]));

  // 1. Per-log confirmations and flags. Acting on your own log never counts.
  const confirmsByLog = new Map();
  const sameCityConfirmsByLog = new Map();
  for (const c of confirmations) {
    const log = logById.get(c.log_id);
    if (!log || log.user_id === c.user_id) continue;
    confirmsByLog.set(log.$id, (confirmsByLog.get(log.$id) ?? 0) + 1);
    if (c.city_id === log.city_id) sameCityConfirmsByLog.set(log.$id, (sameCityConfirmsByLog.get(log.$id) ?? 0) + 1);
  }
  const flaggersByLog = new Map();
  for (const f of flags) {
    const log = logById.get(f.log_id);
    if (!log || log.user_id === f.user_id) continue;
    if (!flaggersByLog.has(log.$id)) flaggersByLog.set(log.$id, new Set());
    flaggersByLog.get(log.$id).add(f.user_id);
  }

  const logPatches = [];
  const derived = new Map();
  for (const log of logs) {
    const confirm_count = confirmsByLog.get(log.$id) ?? 0;
    const flag_count = flaggersByLog.get(log.$id)?.size ?? 0;
    const hidden = flag_count >= HIDE_AT_FLAGS;
    derived.set(log.$id, { confirm_count, flag_count, hidden });
    if (log.confirm_count !== confirm_count || log.flag_count !== flag_count || Boolean(log.hidden) !== hidden) {
      logPatches.push({ id: log.$id, confirm_count, flag_count, hidden });
    }
  }

  // 2. Reputation is recomputed from scratch every run, so it can't drift or be tampered with.
  const userAgg = new Map();
  const agg = (id) => {
    if (!userAgg.has(id)) userAgg.set(id, { logCount: 0, confirmationsReceived: 0, flagsReceived: 0 });
    return userAgg.get(id);
  };
  for (const log of logs) {
    const a = agg(log.user_id);
    a.logCount += 1;
    a.confirmationsReceived += sameCityConfirmsByLog.get(log.$id) ?? 0;
    a.flagsReceived += derived.get(log.$id).flag_count;
  }
  const repOf = new Map();
  const userPatches = [];
  for (const u of users) {
    const a = agg(u.$id);
    const rep = reputation(a.confirmationsReceived, a.flagsReceived);
    repOf.set(u.$id, rep);
    if (u.reputation !== rep || u.log_count !== a.logCount || u.confirmations_received !== a.confirmationsReceived || u.flags_received !== a.flagsReceived) {
      userPatches.push({ id: u.$id, reputation: rep, log_count: a.logCount, confirmations_received: a.confirmationsReceived, flags_received: a.flagsReceived });
    }
  }

  // 3. Group eligible logs by item × scope. Each log feeds its locality, city and state.
  const groups = new Map();
  const groupFor = (item_id, scope_type, scope_id) => {
    const key = `${item_id}|${scope_type}|${scope_id}`;
    if (!groups.has(key)) groups.set(key, { item_id, scope_type, scope_id, range: [], paid: [], quoted: [] });
    return groups.get(key);
  };
  for (const log of logs) {
    if (derived.get(log.$id).hidden) continue;
    const ageDays = (nowMs - new Date(log.created_at).getTime()) / DAY_MS;
    if (ageDays > WINDOW_DAYS || ageDays < -1) continue;

    const point = {
      price: log.price,
      user: log.user_id,
      at: log.created_at,
      w: logWeight({
        reputation: repOf.get(log.user_id) ?? 1,
        ageDays,
        authorLogCount: agg(log.user_id).logCount,
        hasProof: Boolean(log.proof_file_id),
        sameCityConfirms: sameCityConfirmsByLog.get(log.$id) ?? 0,
      }),
    };
    const scopes = [['city', log.city_id], ['state', stateOfCity.get(log.city_id)]];
    if (log.locality_id) scopes.unshift(['locality', log.locality_id]);
    for (const [type, id] of scopes) {
      if (!id) continue;
      const g = groupFor(log.item_id, type, id);
      if (RANGE_TYPES.has(log.price_type)) g.range.push(point);
      if (log.price_type === 'paid') g.paid.push(log.price);
      if (log.price_type === 'quoted') g.quoted.push(log.price);
    }
  }

  // 4. One stats row per group that has at least one paid/listed log.
  const stats = [];
  for (const g of groups.values()) {
    if (g.range.length === 0) continue;
    const [p10, p25, p50, p75, p90] = weightedQuantiles(g.range, [0.1, 0.25, 0.5, 0.75, 0.9]).map(Math.round);
    const nWeighted = g.range.reduce((s, p) => s + p.w, 0);
    const distinctUsers = new Set(g.range.map((p) => p.user)).size;
    const times = g.range.map((p) => new Date(p.at).getTime());
    const newest = Math.max(...times);
    const oldest = Math.min(...times);
    const spread = p25 > 0 ? p75 / p25 : Infinity;
    const overcharge =
      g.quoted.length >= OVERCHARGE_MIN_EACH && g.paid.length >= OVERCHARGE_MIN_EACH
        ? round2(median(g.quoted) / median(g.paid))
        : null;

    stats.push({
      item_id: g.item_id,
      scope_type: g.scope_type,
      scope_id: g.scope_id,
      median: p50,
      p10,
      p25,
      p75,
      p90,
      n_weighted: round2(nWeighted),
      n_raw: g.range.length,
      distinct_users: distinctUsers,
      newest_log_at: new Date(newest).toISOString(),
      oldest_log_at: new Date(oldest).toISOString(),
      confidence: confidenceFor({ nWeighted, distinctUsers, spread, newestAgeDays: (nowMs - newest) / DAY_MS }),
      overcharge_index: overcharge,
      computed_at: now.toISOString(),
    });
  }

  return { stats, logPatches, userPatches };
}

import { Client, TablesDB, Storage, Users, Functions, Query, ID } from 'node-appwrite';
import { buildCard, stateIdOf } from './core/card.js';
import { fnv1a64 } from './core/ids.js';
import { checkPrice, cleanName, cleanText, FLAG_REASONS, LIMITS, PRICE_TYPES } from './core/rules.js';

// The single door for every user write. The browser never writes price rows itself: it calls this Function,
// which learns who the caller is from Appwrite (x-appwrite-user-id, never from the request body), validates
// everything again, applies rate limits, and writes with its own API key. That is what makes "a trusted local
// with a receipt counts more" meaningful: nobody can post as someone else, forge a timestamp or a counter.
//
// POST {action, ...payload}  →  { ok: true, ...result }  |  { ok: false, error: { code, message } }

const DB = 'main';
const RECEIPTS = 'receipts';
const DAY_MS = 86_400_000;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const bad = (code, message) => new HttpError(400, code, message);

export async function handleUser({ req, res, log, error }) {
  const key = req.headers['x-appwrite-key'];
  const client = new Client().setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT).setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID).setKey(key);
  const ctx = { db: new TablesDB(client), storage: new Storage(client), users: new Users(client), fns: new Functions(client), error };

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method', 'Use POST.');
    const body = req.bodyJson ?? safeJson(req.bodyText);
    const action = String(body?.action ?? '');
    const uid = req.headers['x-appwrite-user-id'];
    if (!uid) throw new HttpError(401, 'signed_out', 'Sign in to do that.');

    const handler = ACTIONS[action];
    if (!handler) throw bad('unknown_action', `Unknown action "${action}".`);
    const result = await handler(ctx, uid, body);
    log(`${action} by ${uid.slice(0, 6)}…`);
    return res.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof HttpError) return res.json({ ok: false, error: { code: e.code, message: e.message } }, e.status);
    error(e?.stack ?? String(e));
    return res.json({ ok: false, error: { code: 'internal', message: 'Something went wrong on our side. Try again in a moment.' } }, 500);
  }
}

const ACTIONS = { init, profile, log: logPrice, confirm, flag, ask, reply, helpful };

// ---------------------------------------------------------------- helpers

function safeJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

const isNotFound = (e) => e?.code === 404 || e?.type?.endsWith?.('_not_found');
const isConflict = (e) => e?.code === 409 || e?.type?.endsWith?.('_already_exists');

async function getOr404(ctx, tableId, rowId, what) {
  try {
    return await ctx.db.getRow({ databaseId: DB, tableId, rowId: String(rowId) });
  } catch (e) {
    if (isNotFound(e)) throw new HttpError(404, 'not_found', `We couldn’t find that ${what}.`);
    throw e;
  }
}

const ensured = new Set();

/** Every signed-in caller has exactly one profile row whose id is their account id. */
async function ensureProfile(ctx, uid, { homeCityId, displayName } = {}) {
  let row = null;
  try {
    row = await ctx.db.getRow({ databaseId: DB, tableId: 'users', rowId: uid });
  } catch (e) {
    if (!isNotFound(e)) throw e;
  }
  if (row) {
    ensured.add(uid);
    return row;
  }
  const account = await ctx.users.get({ userId: uid });
  let city = null;
  if (homeCityId) {
    try {
      city = (await ctx.db.getRow({ databaseId: DB, tableId: 'cities', rowId: String(homeCityId) })).$id;
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
  }
  const name = cleanName(displayName || account.name) || 'Local';
  row = await ctx.db.createRow({
    databaseId: DB,
    tableId: 'users',
    rowId: uid,
    data: { auth_id: uid, display_name: name, home_city_id: city, reputation: 1, log_count: 0, confirmations_received: 0, flags_received: 0, is_seed: false },
  });
  ensured.add(uid);
  return row;
}

async function placeFrom(ctx, p) {
  const item = await getOr404(ctx, 'items', p.item_id, 'item');
  const city = await getOr404(ctx, 'cities', p.city_id, 'city');
  let locality = null;
  if (p.locality_id) {
    locality = await getOr404(ctx, 'localities', p.locality_id, 'area');
    if (locality.city_id !== city.$id) throw bad('bad_area', 'That area isn’t in the city you picked.');
  }
  return { item, city, locality };
}

async function enforceDailyLimit(ctx, uid) {
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { total } = await ctx.db.listRows({
    databaseId: DB,
    tableId: 'price_logs',
    queries: [Query.equal('user_id', uid), Query.greaterThan('created_at', since), Query.limit(1)],
  });
  if (total >= LIMITS.pricesPerDay) {
    throw new HttpError(429, 'daily_limit', `You’ve shared ${LIMITS.pricesPerDay} prices today, the daily limit. Come back tomorrow.`);
  }
  return LIMITS.pricesPerDay - total - 1;
}

const coord = (value, lo, hi) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n * 1e5) / 1e5 : null;
};

/** Receipts are proof: the file must exist, belong to the caller, and not already back another price. */
async function verifyReceipt(ctx, uid, fileId) {
  if (!fileId) return null;
  let file;
  try {
    file = await ctx.storage.getFile({ bucketId: RECEIPTS, fileId: String(fileId) });
  } catch {
    throw bad('bad_receipt', 'We couldn’t find that receipt photo. Try attaching it again.');
  }
  if (!file.$permissions.some((p) => p === `read("user:${uid}")`)) throw new HttpError(403, 'not_your_receipt', 'That receipt isn’t yours.');
  const used = await ctx.db.listRows({ databaseId: DB, tableId: 'price_logs', queries: [Query.equal('proof_file_id', file.$id), Query.limit(1)] });
  if (used.total > 0) throw new HttpError(409, 'receipt_used', 'That receipt photo is already attached to another price.');
  return file.$id;
}

/**
 * After a write that can change a range, recompute now instead of waiting for the hourly run.
 * Skipped if the stats were refreshed in the last 15 s, so a burst of writes starts one run, not twenty.
 */
async function refreshStats(ctx) {
  try {
    const last = await ctx.db.listRows({ databaseId: DB, tableId: 'price_stats', queries: [Query.orderDesc('$updatedAt'), Query.limit(1)] });
    if (last.rows[0] && Date.now() - new Date(last.rows[0].$updatedAt).getTime() < 15_000) return 'fresh';
    await ctx.fns.createExecution({ functionId: 'worker', body: JSON.stringify({ action: 'compute' }), async: true });
    return 'started';
  } catch (e) {
    ctx.error(`refreshStats: ${e?.message ?? e}`);
    return 'skipped';
  }
}

// ---------------------------------------------------------------- actions

async function init(ctx, uid, p) {
  const profile = await ensureProfile(ctx, uid, { homeCityId: p.home_city_id, displayName: p.display_name });
  return { profile: pickProfile(profile) };
}

async function profile(ctx, uid, p) {
  const row = await ensureProfile(ctx, uid);
  const data = {};
  if (p.display_name !== undefined) {
    const name = cleanName(p.display_name);
    if (name.length < LIMITS.nameMin) throw bad('bad_name', `Pick a name with at least ${LIMITS.nameMin} characters, like “Arjun K.”`);
    data.display_name = name;
  }
  if (p.home_city_id !== undefined) data.home_city_id = (await getOr404(ctx, 'cities', p.home_city_id, 'city')).$id;
  if (!Object.keys(data).length) return { profile: pickProfile(row) };
  return { profile: pickProfile(await ctx.db.updateRow({ databaseId: DB, tableId: 'users', rowId: uid, data })) };
}

const pickProfile = (r) => ({ id: r.$id, display_name: r.display_name, home_city_id: r.home_city_id, reputation: r.reputation });

async function logPrice(ctx, uid, p) {
  await ensureProfile(ctx, uid);
  const { item, city, locality } = await placeFrom(ctx, p);
  const type = String(p.price_type);
  if (!PRICE_TYPES.includes(type)) throw bad('bad_type', 'Choose paid, quoted or listed.');
  const price = Number(p.price);
  const sane = checkPrice(item, price);
  if (!sane.ok) throw bad(sane.code, sane.message);

  const left = await enforceDailyLimit(ctx, uid);
  const proof = await verifyReceipt(ctx, uid, p.proof_file_id);
  const row = await ctx.db.createRow({
    databaseId: DB,
    tableId: 'price_logs',
    rowId: ID.unique(),
    data: {
      item_id: item.$id,
      locality_id: locality?.$id ?? null,
      city_id: city.$id,
      user_id: uid,
      price,
      price_type: type,
      lat: coord(p.lat, 6, 38),
      lng: coord(p.lng, 67, 98),
      proof_file_id: proof,
      note: cleanText(p.note, LIMITS.noteMax) || null,
      confirm_count: 0,
      flag_count: 0,
      hidden: false,
      is_seed: false,
      created_at: new Date().toISOString(),
    },
  });
  return { id: row.$id, left, refresh: await refreshStats(ctx) };
}

async function confirm(ctx, uid, p) {
  const profile = await ensureProfile(ctx, uid);
  const target = await getOr404(ctx, 'price_logs', p.log_id, 'price');
  if (target.user_id === uid) throw new HttpError(403, 'own_price', 'You can’t confirm your own price.');
  if (target.hidden) throw new HttpError(409, 'hidden', 'That price is under review.');
  try {
    await ctx.db.createRow({
      databaseId: DB,
      tableId: 'confirmations',
      rowId: `cf_${fnv1a64(`${target.$id}|${uid}`)}`,
      data: { log_id: target.$id, user_id: uid, city_id: profile.home_city_id ?? 'unknown', created_at: new Date().toISOString(), is_seed: false },
    });
  } catch (e) {
    if (isConflict(e)) throw new HttpError(409, 'already', 'You already confirmed this price.');
    throw e;
  }
  const confirm_count = (target.confirm_count ?? 0) + 1;
  await ctx.db.updateRow({ databaseId: DB, tableId: 'price_logs', rowId: target.$id, data: { confirm_count } });
  return { confirm_count, refresh: await refreshStats(ctx) };
}

async function flag(ctx, uid, p) {
  await ensureProfile(ctx, uid);
  const reason = String(p.reason);
  if (!FLAG_REASONS.includes(reason)) throw bad('bad_reason', 'Pick a reason for the flag.');
  const target = await getOr404(ctx, 'price_logs', p.log_id, 'price');
  if (target.user_id === uid) throw new HttpError(403, 'own_price', 'You can’t flag your own price.');
  try {
    await ctx.db.createRow({
      databaseId: DB,
      tableId: 'flags',
      rowId: `fl_${fnv1a64(`${target.$id}|${uid}`)}`,
      data: { log_id: target.$id, user_id: uid, reason, created_at: new Date().toISOString(), is_seed: false },
    });
  } catch (e) {
    if (isConflict(e)) throw new HttpError(409, 'already', 'You already flagged this price.');
    throw e;
  }
  const { total } = await ctx.db.listRows({ databaseId: DB, tableId: 'flags', queries: [Query.equal('log_id', target.$id), Query.limit(1)] });
  const hidden = total >= LIMITS.flagsToHide;
  await ctx.db.updateRow({ databaseId: DB, tableId: 'price_logs', rowId: target.$id, data: { flag_count: total, hidden } });
  return { flag_count: total, hidden, refresh: await refreshStats(ctx) };
}

async function ask(ctx, uid, p) {
  await ensureProfile(ctx, uid);
  const { item, city, locality } = await placeFrom(ctx, p);
  const price = Number(p.quoted_price);
  const sane = checkPrice(item, price);
  if (!sane.ok) throw bad(sane.code, sane.message);
  const body = cleanText(p.body, LIMITS.askMax);

  const left = await enforceDailyLimit(ctx, uid);

  // Attach the fair range as it stands right now, so the question stays readable after prices move.
  const scopeIds = [city.$id, stateIdOf(city), ...(locality ? [locality.$id] : [])];
  const stats = await ctx.db.listRows({ databaseId: DB, tableId: 'price_stats', queries: [Query.equal('item_id', item.$id), Query.equal('scope_id', scopeIds), Query.limit(10)] });
  const category = await ctx.db.getRow({ databaseId: DB, tableId: 'categories', rowId: item.category_id });
  const card = buildCard({ item, hyperlocal: category.hyperlocal, city, locality, rows: stats.rows });
  const attached = JSON.stringify(card);

  const now = new Date().toISOString();
  const qcId = ID.unique();
  await ctx.db.createRow({
    databaseId: DB,
    tableId: 'quote_checks',
    rowId: qcId,
    data: {
      user_id: uid,
      item_id: item.$id,
      locality_id: locality?.$id ?? null,
      city_id: city.$id,
      quoted_price: price,
      body: body || null,
      attached_stats_id: card.status === 'ok' ? (card.statsId ?? null) : null,
      attached_card: attached.length <= 1990 ? attached : null,
      helpful_reply_id: null,
      reply_count: 0,
      is_seed: false,
      created_at: now,
    },
  });
  // A question also records the quote, so asking improves the overcharge index.
  await ctx.db.createRow({
    databaseId: DB,
    tableId: 'price_logs',
    rowId: `${qcId}_q`,
    data: {
      item_id: item.$id,
      locality_id: locality?.$id ?? null,
      city_id: city.$id,
      user_id: uid,
      price,
      price_type: 'quoted',
      lat: coord(p.lat, 6, 38),
      lng: coord(p.lng, 67, 98),
      proof_file_id: null,
      note: 'asked as a question',
      confirm_count: 0,
      flag_count: 0,
      hidden: false,
      is_seed: false,
      created_at: now,
    },
  });
  return { id: qcId, left, refresh: await refreshStats(ctx) };
}

async function reply(ctx, uid, p) {
  await ensureProfile(ctx, uid);
  const qc = await getOr404(ctx, 'quote_checks', p.quote_check_id, 'question');
  const body = cleanText(p.body, LIMITS.replyMax);
  if (body.length < 2) throw bad('empty_reply', 'Write a short answer first.');
  const row = await ctx.db.createRow({
    databaseId: DB,
    tableId: 'replies',
    rowId: ID.unique(),
    data: { quote_check_id: qc.$id, user_id: uid, body, is_seed: false, created_at: new Date().toISOString() },
  });
  const { total } = await ctx.db.listRows({ databaseId: DB, tableId: 'replies', queries: [Query.equal('quote_check_id', qc.$id), Query.limit(1)] });
  await ctx.db.updateRow({ databaseId: DB, tableId: 'quote_checks', rowId: qc.$id, data: { reply_count: total } });
  return { id: row.$id, reply_count: total };
}

async function helpful(ctx, uid, p) {
  const qc = await getOr404(ctx, 'quote_checks', p.quote_check_id, 'question');
  if (qc.user_id !== uid) throw new HttpError(403, 'not_asker', 'Only the person who asked can mark an answer helpful.');
  const r = await getOr404(ctx, 'replies', p.reply_id, 'answer');
  if (r.quote_check_id !== qc.$id) throw bad('bad_reply', 'That answer belongs to another question.');
  await ctx.db.updateRow({ databaseId: DB, tableId: 'quote_checks', rowId: qc.$id, data: { helpful_reply_id: r.$id } });
  return { helpful_reply_id: r.$id };
}

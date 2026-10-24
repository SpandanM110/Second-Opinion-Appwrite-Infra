import { Client, TablesDB, Query } from 'node-appwrite';
import { computeAll } from './core/engine.js';
import { statsRowId } from './core/ids.js';

const DB = 'main';
const PAGE = 500;
const WRITE_CONCURRENCY = 10;

// The only writer of price_stats, reputation fields and log counters.
// Idempotent: every run recomputes from the raw rows, so re-runs are always safe.
export const runCompute = async ({ req, res, log, error }) => {
  const t0 = Date.now();
  const db = new TablesDB(
    new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(req.headers['x-appwrite-key']),
  );
  const now = new Date();

  const [logs, users, confirmations, flags, cities] = await Promise.all(
    ['price_logs', 'users', 'confirmations', 'flags', 'cities'].map((t) => listAll(db, t)),
  );
  const tRead = Date.now();

  const { stats, logPatches, userPatches } = computeAll({ logs, users, confirmations, flags, cities, now });

  const statRows = stats.map((s) => ({ $id: statsRowId(s.item_id, s.scope_type, s.scope_id), ...s }));
  for (let i = 0; i < statRows.length; i += 100) {
    await db.upsertRows({ databaseId: DB, tableId: 'price_stats', rows: statRows.slice(i, i + 100) });
  }
  // Scopes that lost all their data this run (e.g. their only logs got hidden).
  await db.deleteRows({ databaseId: DB, tableId: 'price_stats', queries: [Query.lessThan('computed_at', now.toISOString())] });

  await pool(logPatches, ({ id, ...data }) => db.updateRow({ databaseId: DB, tableId: 'price_logs', rowId: id, data }));
  await pool(userPatches, ({ id, ...data }) => db.updateRow({ databaseId: DB, tableId: 'users', rowId: id, data }));

  const summary = {
    ok: true,
    read: { logs: logs.length, users: users.length, confirmations: confirmations.length, flags: flags.length },
    wrote: { stats: statRows.length, logPatches: logPatches.length, userPatches: userPatches.length },
    hidden: logPatches.filter((p) => p.hidden).map((p) => p.id),
    ms: { read: tRead - t0, total: Date.now() - t0 },
    computedAt: now.toISOString(),
  };
  log(JSON.stringify(summary));
  if (summary.ms.total > 20_000) error(`compute-stats slow: ${summary.ms.total} ms`);
  return res.json(summary);
};

async function listAll(db, tableId) {
  const rows = [];
  let cursor = null;
  for (;;) {
    const queries = [Query.limit(PAGE), Query.orderAsc('$id')];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await db.listRows({ databaseId: DB, tableId, queries });
    rows.push(...page.rows);
    if (page.rows.length < PAGE) return rows;
    cursor = page.rows[page.rows.length - 1].$id;
  }
}

async function pool(items, fn) {
  for (let i = 0; i < items.length; i += WRITE_CONCURRENCY) {
    await Promise.all(items.slice(i, i + WRITE_CONCURRENCY).map(fn));
  }
}

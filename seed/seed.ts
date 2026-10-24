// Seeds the Second Opinion demo dataset into Appwrite TablesDB.
//
//   npm run seed:dry    generate locally, run the real stats engine, print the plan's seed checklist
//   npm run seed        write to Appwrite (mints a 1-hour API key via the CLI), then run compute-stats
//   npm run seed -- --all   also wipe NON-seed user rows (only before launch)
//
// Re-running is safe: reference rows are upserted, seed rows (is_seed = true) are wiped and recreated,
// and real users' rows are left alone unless --all is passed.

import { Client, TablesDB, Storage, Functions, Query, ExecutionMethod } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { computeAll } from '../core/engine.js';
import { buildCard } from '../core/card.js';
import { statsRowId } from '../core/ids.js';
import { cities, localities, categories, items, users, seedUsers, generate, quoteChecks, type LogRow, type Row } from './generate.ts';
import { receiptPng } from './receipt-png.ts';

const DB = 'main';
const BUCKET = 'receipts';
const DAY_MS = 86_400_000;
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const WIPE_ALL = args.has('--all');

const now = new Date();
const { logs, confirmations, flags, outlierIds } = generate(now);

// Every Quote Check also writes a `quoted` log (F6), so questions feed the overcharge index.
for (const qc of quoteChecks) {
  const l = localities.find((x) => x.$id === qc.locality);
  if (!l) throw new Error(`quote check ${qc.id}: unknown locality ${qc.locality}`);
  logs.push({
    $id: `${qc.id}-log`, item_id: qc.item, locality_id: qc.locality, city_id: qc.city, user_id: qc.asker,
    price: qc.quoted, price_type: 'quoted', lat: l.lat as number, lng: l.lng as number, proof_file_id: null,
    note: 'asked as a Quote Check', created_at: new Date(now.getTime() - qc.days * DAY_MS).toISOString(), is_seed: true,
  });
}

validate();

// Pre-apply the engine's counters so rows land consistent; the Function then has little to patch.
const receiptLogs = logs.filter((l) => l.needsReceipt);
const engineInput = () => ({
  logs: logs.map((l) => ({ ...l, proof_file_id: l.needsReceipt ? (l.proof_file_id ?? 'pending') : null })),
  users, confirmations, flags, cities, now,
});
const pre = computeAll(engineInput());
for (const p of pre.logPatches) Object.assign(logs.find((l) => l.$id === p.id)!, { confirm_count: p.confirm_count, flag_count: p.flag_count, hidden: p.hidden });
for (const p of pre.userPatches) Object.assign(users.find((u) => u.$id === p.id)!, { reputation: p.reputation, log_count: p.log_count, confirmations_received: p.confirmations_received, flags_received: p.flags_received });

if (DRY) {
  report(pre.stats);
} else {
  await writeAll();
}

// ---------------------------------------------------------------------------

function validate() {
  const locIds = new Set(localities.map((l) => l.$id));
  const itemIds = new Set(items.map((i) => i.$id));
  const userIds = new Set(users.map((u) => u.$id));
  const problems: string[] = [];
  if (locIds.size !== localities.length) problems.push('duplicate locality ids');
  for (const l of localities) if (l.$id.length > 36) problems.push(`locality id too long: ${l.$id}`);
  for (const l of logs) {
    if (l.locality_id && !locIds.has(l.locality_id)) problems.push(`log ${l.$id}: unknown locality ${l.locality_id}`);
    if (!itemIds.has(l.item_id)) problems.push(`log ${l.$id}: unknown item ${l.item_id}`);
    if (!userIds.has(l.user_id)) problems.push(`log ${l.$id}: unknown user ${l.user_id}`);
  }
  for (const qc of quoteChecks) for (const [u] of qc.replies) if (!userIds.has(u)) problems.push(`${qc.id}: unknown replier ${u}`);
  if (problems.length) {
    console.error(problems.slice(0, 20).join('\n'));
    process.exit(1);
  }
}

function cardFor(stats: Row[], itemId: string, cityId: string, localityId: string | null) {
  const item = items.find((i) => i.$id === itemId)!;
  const cat = categories.find((c) => c.$id === item.category_id)!;
  return buildCard({
    item, hyperlocal: cat.hyperlocal as boolean,
    city: cities.find((c) => c.$id === cityId)!,
    locality: localityId ? localities.find((l) => l.$id === localityId)! : null,
    rows: stats.filter((s) => s.item_id === itemId), now,
  });
}

function report(statsIn: Array<Record<string, unknown>>) {
  const stats = statsIn.map((s) => ({ ...s, $id: statsRowId(s.item_id as string, s.scope_type as string, s.scope_id as string) })) as Row[];
  const count = (t: string) => logs.filter((l) => l.price_type === t).length;
  console.log(`\nDataset: ${cities.length} cities, ${localities.length} localities, ${categories.length} categories, ${items.length} items, ${users.length} users`);
  console.log(`Logs: ${logs.length} (paid ${count('paid')}, listed ${count('listed')}, quoted ${count('quoted')}); receipts ${receiptLogs.length}`);
  console.log(`Confirmations ${confirmations.length}, flags ${flags.length}, quote checks ${quoteChecks.length} with ${quoteChecks.reduce((s, q) => s + q.replies.length, 0)} replies`);
  console.log(`Stats rows: ${stats.length}`);
  const reps = users.map((u) => u.reputation as number).sort((a, b) => a - b);
  console.log(`Reputation range ${reps[0]} – ${reps[reps.length - 1]}; trusted: ${seedUsers.filter((u) => u.role === 'trusted').map((u) => `${u.display_name} ${users.find((x) => x.$id === u.$id)!.reputation}`).join(', ')}`);
  const newbies = seedUsers.filter((u) => u.role === 'new').map((u) => `${u.$id}=${users.find((x) => x.$id === u.$id)!.log_count} logs`);
  console.log(`New accounts (half weight under 10 logs): ${newbies.join(', ')}`);

  console.log('\nCity-scope card per item (median · band · confidence):');
  const header = 'item'.padEnd(26) + ['bhopal', 'indore', 'mumbai'].map((c) => c.padEnd(30)).join('');
  console.log(header);
  for (const it of items) {
    const cells = ['bhopal', 'indore', 'mumbai'].map((c) => {
      const card = cardFor(stats, it.$id, c, null);
      if (card.status !== 'ok') return 'no data'.padEnd(30);
      return `₹${card.range.median} · ${card.range.p25}–${card.range.p75} · ${card.confidence.level}`.padEnd(30);
    });
    console.log(String(it.$id).padEnd(26) + cells.join(''));
  }

  const checks: [string, boolean, string][] = [];
  const bhopalCity = items.map((it) => ({ it: it.$id, card: cardFor(stats, it.$id, 'bhopal', null) }));
  const weak = bhopalCity.filter((x) => x.card.status !== 'ok' || !['high', 'medium'].includes(x.card.confidence.level));
  checks.push(['Every item is Medium or High for Bhopal city scope', weak.length === 0, weak.map((w) => w.it).join(', ') || `${items.length}/${items.length}`]);

  const autoHigh = stats.filter((s) => s.item_id === 'auto-per-km' && s.scope_type === 'locality' && String(s.scope_id).startsWith('bpl-') && s.confidence === 'high');
  checks.push(['≥ 6 Bhopal localities High for auto per km', autoHigh.length >= 6, `${autoHigh.length}: ${autoHigh.map((s) => s.scope_id).join(', ')}`]);

  const hg = 'bpl-rani-kamlapati-station';
  const hgStation = stats.find((s) => s.item_id === 'auto-station-to-centre' && s.scope_id === hg);
  const hgKm = stats.find((s) => s.item_id === 'auto-per-km' && s.scope_id === hg);
  checks.push(['Habibganj station overcharge index > 2.0', (hgStation?.overcharge_index as number) > 2, `station-to-centre ${hgStation?.overcharge_index}, per km ${hgKm?.overcharge_index ?? 'n/a (paid thin)'}`]);
  const resi = stats.filter((s) => s.scope_type === 'locality' && s.item_id === 'auto-per-km' && s.overcharge_index != null && localities.find((l) => l.$id === s.scope_id)?.kind === 'residential');
  checks.push(['Residential localities overcharge close to 1.0', resi.every((s) => (s.overcharge_index as number) < 1.6), resi.map((s) => `${s.scope_id} ${s.overcharge_index}`).join(', ') || 'none with ≥3 quoted+paid']);

  const demo = cardFor(stats, 'auto-station-to-centre', 'bhopal', hg);
  checks.push(['Demo card: station → centre at Habibganj', demo.status === 'ok' && demo.confidence.level === 'high',
    demo.status === 'ok' ? `₹${demo.range.median}, ₹${demo.range.p25}–${demo.range.p75}, ${demo.confidence.level} · ${demo.sample.line} · ${demo.overcharge?.line}` : 'no data']);

  const outlierFlags = outlierIds.map((id) => flags.filter((f) => f.log_id === id).length);
  checks.push(['Outliers exist with 2 flags each (third flag hides)', outlierFlags.every((n) => n === 2), `${outlierIds.length} outliers`]);

  const mumbai = cardFor(stats, 'mens-haircut', 'mumbai', null);
  const bhopal = cardFor(stats, 'mens-haircut', 'bhopal', null);
  if (mumbai.status === 'ok' && bhopal.status === 'ok') checks.push(['Compare renders (men’s haircut, Bhopal vs Mumbai)', true, `₹${bhopal.range.median} vs ₹${mumbai.range.median} → ${(mumbai.range.median / bhopal.range.median).toFixed(1)}x`]);

  console.log('\nSeed checklist:');
  for (const [name, ok, detail] of checks) console.log(`  ${ok ? '✓' : '✗'} ${name} — ${detail}`);
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
}

// ---------------------------------------------------------------------------

async function writeAll() {
  const endpoint = process.env.APPWRITE_ENDPOINT!;
  const project = process.env.APPWRITE_PROJECT_ID!;
  const key = process.env.APPWRITE_API_KEY!;
  if (!endpoint || !project || !key) throw new Error('Run via `npm run seed` so an API key is minted, or set APPWRITE_ENDPOINT/PROJECT_ID/API_KEY.');
  const client = new Client().setEndpoint(endpoint).setProject(project).setKey(key);
  const db = new TablesDB(client);
  const storage = new Storage(client);
  const functions = new Functions(client);
  const t0 = Date.now();
  const step = (msg: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s] ${msg}`);

  const strip = (r: Row) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'needsReceipt'));
  async function bulk(tableId: string, rows: Row[], mode: 'create' | 'upsert') {
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100).map(strip);
      if (mode === 'create') await db.createRows({ databaseId: DB, tableId, rows: batch });
      else await db.upsertRows({ databaseId: DB, tableId, rows: batch });
    }
    step(`${mode === 'create' ? 'created' : 'upserted'} ${rows.length} ${tableId}`);
  }

  // 1. Wipe seed rows (children first). price_stats is fully owned by the Function, so it is cleared too.
  for (const tableId of ['replies', 'quote_checks', 'flags', 'confirmations', 'price_logs', 'users']) {
    await db.deleteRows({ databaseId: DB, tableId, queries: WIPE_ALL ? [] : [Query.equal('is_seed', true)] });
  }
  await db.deleteRows({ databaseId: DB, tableId: 'price_stats', queries: [] });
  step(`wiped ${WIPE_ALL ? 'ALL user rows' : 'seed rows'} and price_stats`);

  let removed = 0;
  for (;;) {
    const { files } = await storage.listFiles({ bucketId: BUCKET, queries: [Query.startsWith('name', 'seed-receipt'), Query.limit(100)] });
    if (files.length === 0) break;
    await Promise.all(files.map((f) => storage.deleteFile({ bucketId: BUCKET, fileId: f.$id })));
    removed += files.length;
  }
  step(`removed ${removed} seed receipts`);

  // 2. Reference data.
  await bulk('cities', cities, 'upsert');
  await bulk('localities', localities, 'upsert');
  await bulk('categories', categories, 'upsert');
  await bulk('items', items, 'upsert');

  // 3. Users, receipts, logs, social rows.
  await bulk('users', users, 'create');

  for (let i = 0; i < receiptLogs.length; i += 10) {
    await Promise.all(receiptLogs.slice(i, i + 10).map(async (log, j) => {
      const n = i + j + 1;
      const file = await storage.createFile({
        bucketId: BUCKET, fileId: `seed-rc-${String(n).padStart(5, '0')}`,
        file: InputFile.fromBuffer(receiptPng(n), `seed-receipt-${n}.png`),
        permissions: [], // proof, not public content: only server keys can read seeded receipts
      });
      log.proof_file_id = file.$id;
    }));
  }
  step(`uploaded ${receiptLogs.length} placeholder receipts`);

  await bulk('price_logs', logs, 'create');
  await bulk('confirmations', confirmations, 'create');
  await bulk('flags', flags, 'create');

  // 4. Stats, via the real Function (also proves its scheduled path works end to end).
  step('running compute-stats …');
  const exec = await functions.createExecution({ functionId: 'compute-stats', async: true, method: ExecutionMethod.POST });
  let done = exec;
  while (done.status === 'waiting' || done.status === 'processing') {
    await new Promise((r) => setTimeout(r, 1500));
    done = await functions.getExecution({ functionId: 'compute-stats', executionId: exec.$id });
  }
  if (done.status !== 'completed') throw new Error(`compute-stats ${done.status}: ${done.errors || done.responseBody}`);
  step(`compute-stats ${done.status} in ${done.duration.toFixed(1)}s → ${done.responseBody}`);

  // 5. Quote Checks carry a snapshot of the card as it was when asked.
  const stats: Row[] = [];
  for (let cursor: string | null = null; ;) {
    const page = await db.listRows({ databaseId: DB, tableId: 'price_stats', queries: [Query.limit(500), ...(cursor ? [Query.cursorAfter(cursor)] : [])] });
    stats.push(...(page.rows as unknown as Row[]));
    if (page.rows.length < 500) break;
    cursor = page.rows[page.rows.length - 1].$id;
  }
  const qcRows: Row[] = [];
  const replyRows: Row[] = [];
  for (const qc of quoteChecks) {
    const card = cardFor(stats, qc.item, qc.city, qc.locality);
    const replies = qc.replies.map(([user, body, helpful], k) => ({
      $id: `${qc.id}-r${k + 1}`, quote_check_id: qc.id, user_id: user, body, is_seed: true, helpful: Boolean(helpful),
      created_at: new Date(now.getTime() - qc.days * DAY_MS + (k + 1) * (8 + k * 11) * 60_000).toISOString(),
    }));
    qcRows.push({
      $id: qc.id, user_id: qc.asker, item_id: qc.item, locality_id: qc.locality, city_id: qc.city, quoted_price: qc.quoted, body: qc.body,
      attached_stats_id: card.status === 'ok' ? card.statsId : null,
      attached_card: JSON.stringify(card),
      helpful_reply_id: replies.find((r) => r.helpful)?.$id ?? null,
      reply_count: replies.length, is_seed: true, created_at: new Date(now.getTime() - qc.days * DAY_MS).toISOString(),
    });
    replyRows.push(...replies.map(({ helpful: _h, ...r }) => r));
  }
  await bulk('quote_checks', qcRows, 'create');
  await bulk('replies', replyRows, 'create');

  step('done');
  report(stats as unknown as Array<Record<string, unknown>>);
}


// End-to-end test of the verified write path, run as real signed-in users.
//   node scripts/with-key.mjs tsx scripts/e2e-backend.ts
// Creates throwaway accounts, exercises every action and every rejection, then deletes everything it made.

import { Client, Functions, Storage, TablesDB, Users, Query, ID, Permission, Role, ExecutionMethod } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { receiptPng } from '../seed/receipt-png.ts';

const endpoint = process.env.APPWRITE_ENDPOINT!;
const project = process.env.APPWRITE_PROJECT_ID!;
const admin = new Client().setEndpoint(endpoint).setProject(project).setKey(process.env.APPWRITE_API_KEY!);
const db = new TablesDB(admin);
const users = new Users(admin);
const adminStorage = new Storage(admin);

const stamp = Date.now().toString(36);
const created: string[] = [];
const results: string[] = [];
let failed = 0;

const check = (name: string, ok: boolean, detail = '') => {
  results.push(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

async function person(tag: string) {
  const email = `e2e-${stamp}-${tag}@example.com`;
  const u = await users.create({ userId: ID.unique(), email, password: `pw-${stamp}-${tag}-xyz`, name: `E2E ${tag.toUpperCase()}` });
  created.push(u.$id);
  const session = await users.createSession({ userId: u.$id });
  const client = new Client().setEndpoint(endpoint).setProject(project).setSession(session.secret);
  const fns = new Functions(client);
  const call = async (body: Record<string, unknown>) => {
    const ex = await fns.createExecution({ functionId: 'worker', body: JSON.stringify(body), async: false, method: ExecutionMethod.POST, headers: { 'content-type': 'application/json' } });
    let json: any = {};
    try {
      json = JSON.parse(ex.responseBody);
    } catch {
      /* not json */
    }
    return { status: ex.responseStatusCode, ...json } as { status: number; ok?: boolean; error?: { code: string; message: string }; [k: string]: any };
  };
  return { id: u.$id, call, storage: new Storage(client) };
}

const LOG = { item_id: 'auto-per-km', city_id: 'bhopal', locality_id: 'bpl-mp-nagar', price_type: 'paid', lat: 23.2332, lng: 77.4343 };

try {
  const [A, B, C, D, E] = await Promise.all(['a', 'b', 'c', 'd', 'e'].map(person));

  // --- identity -----------------------------------------------------------------------------------------
  try {
    await new Functions(new Client().setEndpoint(endpoint).setProject(project)).createExecution({ functionId: 'worker', body: '{"action":"log"}', async: false });
    check('signed-out callers cannot reach the worker', false, 'call succeeded');
  } catch (e: any) {
    check('signed-out callers cannot reach the worker', e.code === 401 || e.code === 403, `HTTP ${e.code}`);
  }
  const ping = await A.call({ action: 'ping' });
  check('ping works for a signed-in user', ping.ok === true);
  const noCompute = await A.call({ action: 'compute' });
  check('a user cannot start a recompute', noCompute.status === 403, `HTTP ${noCompute.status}`);

  const init = await A.call({ action: 'init', home_city_id: 'bhopal' });
  check('init creates the profile, name from the account', init.ok && init.profile.id === A.id && init.profile.display_name === 'E2E A', JSON.stringify(init.profile));
  check('profile starts at reputation 1.0 and the right home city', init.profile?.reputation === 1 && init.profile?.home_city_id === 'bhopal');
  await B.call({ action: 'init', home_city_id: 'bhopal' });
  await C.call({ action: 'init', home_city_id: 'indore' });
  await D.call({ action: 'init', home_city_id: 'bhopal' });
  await E.call({ action: 'init', home_city_id: 'bhopal' });

  // --- logging a price ----------------------------------------------------------------------------------
  const before = (await db.listRows({ databaseId: 'main', tableId: 'price_stats', queries: [Query.equal('item_id', 'auto-per-km'), Query.equal('scope_id', 'bpl-mp-nagar')] })).rows[0] as any;
  const t0 = Date.now();
  const first = await A.call({ action: 'log', ...LOG, client_ref: `ref-${stamp}`, price: 20, note: '  after   bargaining  ', user_id: 'seed-u01', created_at: '2020-01-01T00:00:00Z', confirm_count: 99, hidden: true, is_seed: true });
  check('a valid price is saved', first.ok && first.id, `${Date.now() - t0} ms, ${first.left} left today, stats ${first.refresh}`);
  const row = (await db.getRow({ databaseId: 'main', tableId: 'price_logs', rowId: first.id })) as any;
  check('the author is the caller, not what the body claimed', row.user_id === A.id, row.user_id);
  check('server sets the time, counters and flags (forged fields ignored)', row.created_at > '2026' && row.confirm_count === 0 && row.hidden === false && row.is_seed === false, `${row.created_at} c=${row.confirm_count} h=${row.hidden}`);
  check('note is cleaned', row.note === 'after bargaining', JSON.stringify(row.note));

  const again = await A.call({ action: 'log', ...LOG, client_ref: `ref-${stamp}`, price: 20 });
  check('sending the same submission again is a no-op, not a duplicate', again.ok && again.duplicate === true && again.id === first.id, JSON.stringify(again).slice(0, 90));
  const mine = await db.listRows({ databaseId: 'main', tableId: 'price_logs', queries: [Query.equal('user_id', A.id), Query.limit(50)] });
  check('exactly one row exists for it', mine.rows.filter((r: any) => r.price === 20).length === 1);

  const typo = await A.call({ action: 'log', ...LOG, price: 900 });
  check('an absurd price is rejected with advice', typo.status === 400 && typo.error?.code === 'too_high' && /per km/.test(typo.error.message), typo.error?.message?.slice(0, 80));
  check('a bad price type is rejected', (await A.call({ action: 'log', ...LOG, price: 20, price_type: 'free' })).status === 400);
  check('a locality from another city is rejected', (await A.call({ action: 'log', ...LOG, locality_id: 'idr-palasia', price: 20 })).error?.code === 'bad_area');
  check('an unknown item is rejected', (await A.call({ action: 'log', ...LOG, item_id: 'nope', price: 20 })).status === 404);
  check('a decimal price is rejected', (await A.call({ action: 'log', ...LOG, price: 12.5 })).error?.code === 'bad_price');

  // --- receipts -----------------------------------------------------------------------------------------
  const file = await A.storage.createFile({ bucketId: 'receipts', fileId: ID.unique(), file: InputFile.fromBuffer(receiptPng(7), `e2e-${stamp}.png`), permissions: [Permission.read(Role.user(A.id))] });
  const withReceipt = await A.call({ action: 'log', ...LOG, price: 21, proof_file_id: file.$id });
  check('a price with the caller’s own receipt is saved', withReceipt.ok === true, withReceipt.error?.message);
  check('someone else cannot attach A’s receipt', (await B.call({ action: 'log', ...LOG, price: 21, proof_file_id: file.$id })).error?.code === 'not_your_receipt');
  check('a receipt cannot back two prices', (await A.call({ action: 'log', ...LOG, price: 22, proof_file_id: file.$id })).error?.code === 'receipt_used');
  check('a made-up receipt id is rejected', (await A.call({ action: 'log', ...LOG, price: 22, proof_file_id: 'nope' })).error?.code === 'bad_receipt');

  // --- confirm ------------------------------------------------------------------------------------------
  const c1 = await B.call({ action: 'confirm', log_id: first.id });
  check('another user can confirm', c1.ok && c1.confirm_count === 1, JSON.stringify(c1).slice(0, 80));
  check('confirming twice is refused', (await B.call({ action: 'confirm', log_id: first.id })).error?.code === 'already');
  check('you cannot confirm your own price', (await A.call({ action: 'confirm', log_id: first.id })).error?.code === 'own_price');

  // --- flag (three distinct people hide a price) --------------------------------------------------------
  const target = await A.call({ action: 'log', ...LOG, price: 19 });
  const f1 = await B.call({ action: 'flag', log_id: target.id, reason: 'typo' });
  const f2 = await C.call({ action: 'flag', log_id: target.id, reason: 'wrong_unit' });
  check('two flags do not hide a price', f1.flag_count === 1 && f2.flag_count === 2 && f2.hidden === false);
  check('flagging twice is refused', (await B.call({ action: 'flag', log_id: target.id, reason: 'typo' })).error?.code === 'already');
  check('you cannot flag your own price', (await A.call({ action: 'flag', log_id: target.id, reason: 'typo' })).error?.code === 'own_price');
  check('an invalid reason is refused', (await D.call({ action: 'flag', log_id: target.id, reason: 'because' })).error?.code === 'bad_reason');
  const f3 = await D.call({ action: 'flag', log_id: target.id, reason: 'tourist_price' });
  check('the third flag hides the price immediately', f3.flag_count === 3 && f3.hidden === true);
  check('a hidden price cannot be confirmed', (await E.call({ action: 'confirm', log_id: target.id })).error?.code === 'hidden');

  // --- ask, reply, helpful ------------------------------------------------------------------------------
  const ask = await A.call({ action: 'ask', item_id: 'auto-station-to-centre', city_id: 'bhopal', locality_id: 'bpl-rani-kamlapati-station', quoted_price: 300, body: 'Quoted 300 at the gate, fair?' });
  check('asking a question works', ask.ok && ask.id, ask.error?.message);
  const qc = (await db.getRow({ databaseId: 'main', tableId: 'quote_checks', rowId: ask.id })) as any;
  const card = JSON.parse(qc.attached_card ?? 'null');
  check('the fair price is attached to the question', card?.status === 'ok' && card.range.median > 50, card ? `₹${card.range.median}` : 'none');
  const qlog = (await db.getRow({ databaseId: 'main', tableId: 'price_logs', rowId: `${ask.id}_q` })) as any;
  check('asking also records the first quote', qlog.price === 300 && qlog.price_type === 'quoted' && qlog.user_id === A.id);

  const r1 = await B.call({ action: 'reply', quote_check_id: ask.id, body: 'No, ₹100–120 is normal.' });
  check('anyone signed in can reply', r1.ok && r1.reply_count === 1, r1.error?.message);
  check('an empty reply is refused', (await B.call({ action: 'reply', quote_check_id: ask.id, body: ' ' })).error?.code === 'empty_reply');
  check('only the asker can mark a reply helpful', (await B.call({ action: 'helpful', quote_check_id: ask.id, reply_id: r1.id })).status === 403);
  const h = await A.call({ action: 'helpful', quote_check_id: ask.id, reply_id: r1.id });
  check('the asker can mark a reply helpful', h.ok && h.helpful_reply_id === r1.id);

  // --- daily limit --------------------------------------------------------------------------------------
  let limited: any = null;
  for (let i = 0; i < 21; i++) {
    const r = await E.call({ action: 'log', ...LOG, price: 18 + (i % 5) });
    if (!r.ok) {
      limited = r;
      check('the 21st price in a day is refused', i === 20 && r.status === 429 && r.error?.code === 'daily_limit', `stopped at #${i + 1}`);
      break;
    }
  }
  if (!limited) check('the 21st price in a day is refused', false, 'never limited');

  // --- answers are capped too
  let replyLimited: any = null;
  for (let i = 0; i < 41; i++) {
    const r = await D.call({ action: 'reply', quote_check_id: ask.id, body: `answer number ${i + 1}` });
    if (!r.ok) {
      replyLimited = r;
      check('the 41st answer in a day is refused', i === 40 && r.status === 429 && r.error?.code === 'daily_limit', `stopped at #${i + 1}`);
      break;
    }
  }
  if (!replyLimited) check('the 41st answer in a day is refused', false, 'never limited');

  // --- the stats pick it up -----------------------------------------------------------------------------
  let after: any = before;
  for (let i = 0; i < 12; i++) {
    after = (await db.listRows({ databaseId: 'main', tableId: 'price_stats', queries: [Query.equal('item_id', 'auto-per-km'), Query.equal('scope_id', 'bpl-mp-nagar')] })).rows[0];
    if (after.n_raw > before.n_raw) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  check('the new prices reach the fair range within ~30 s, without waiting for the hourly run', after.n_raw > before.n_raw, `n_raw ${before.n_raw} → ${after.n_raw}`);
  const prof = (await db.getRow({ databaseId: 'main', tableId: 'users', rowId: B.id })) as any;
  check('profile row exists for the confirmer', prof.auth_id === B.id);
} catch (e: any) {
  check('test run completed', false, e?.stack ?? String(e));
} finally {
  // cleanup: everything these accounts created, then the accounts
  const ids = created;
  for (const [table, field] of [['replies', 'user_id'], ['quote_checks', 'user_id'], ['confirmations', 'user_id'], ['flags', 'user_id'], ['price_logs', 'user_id']] as const) {
    for (const id of ids) {
      for (;;) {
        const { rows } = await db.listRows({ databaseId: 'main', tableId: table, queries: [Query.equal(field, id), Query.limit(100)] });
        if (!rows.length) break;
        await Promise.all(rows.map((r) => db.deleteRow({ databaseId: 'main', tableId: table, rowId: r.$id })));
      }
    }
  }
  const stray = await db.listRows({ databaseId: 'main', tableId: 'replies', queries: [Query.startsWith('body', 'No, ₹100'), Query.limit(50)] }).catch(() => ({ rows: [] }));
  void stray;
  for (const id of ids) await db.deleteRow({ databaseId: 'main', tableId: 'users', rowId: id }).catch(() => {});
  const files = await adminStorage.listFiles({ bucketId: 'receipts', queries: [Query.startsWith('name', `e2e-${stamp}`), Query.limit(50)] }).catch(() => ({ files: [] }));
  for (const f of files.files) await adminStorage.deleteFile({ bucketId: 'receipts', fileId: f.$id }).catch(() => {});
  for (const id of ids) await users.delete({ userId: id }).catch(() => {});
  console.log(results.join('\n'));
  console.log(`\n${failed === 0 ? 'ALL PASSED' : `${failed} FAILED`}; cleaned up ${ids.length} test accounts`);
  process.exit(failed ? 1 : 0);
}

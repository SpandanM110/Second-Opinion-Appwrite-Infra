// Removes every throwaway account (and what it created) left behind by interrupted end-to-end runs.
//   node scripts/with-key.mjs npx tsx scripts/e2e-clean.ts
import { Client, Query, Storage, TablesDB, Users } from 'node-appwrite';

const admin = new Client().setEndpoint(process.env.APPWRITE_ENDPOINT!).setProject(process.env.APPWRITE_PROJECT_ID!).setKey(process.env.APPWRITE_API_KEY!);
const db = new TablesDB(admin);
const users = new Users(admin);
const storage = new Storage(admin);

const found = await users.list({ queries: [Query.startsWith('email', 'e2e-'), Query.limit(100)] });
let rows = 0;
for (const u of found.users) {
  for (const table of ['replies', 'quote_checks', 'confirmations', 'flags', 'price_logs']) {
    for (;;) {
      const r = await db.listRows({ databaseId: 'main', tableId: table, queries: [Query.equal('user_id', u.$id), Query.limit(100)] });
      if (!r.rows.length) break;
      await Promise.all(r.rows.map((x) => db.deleteRow({ databaseId: 'main', tableId: table, rowId: x.$id })));
      rows += r.rows.length;
    }
  }
  await db.deleteRow({ databaseId: 'main', tableId: 'users', rowId: u.$id }).catch(() => {});
  await users.delete({ userId: u.$id });
}
const files = await storage.listFiles({ bucketId: 'receipts', queries: [Query.startsWith('name', 'e2e-'), Query.limit(100)] });
for (const f of files.files) await storage.deleteFile({ bucketId: 'receipts', fileId: f.$id });
console.log(`removed ${found.total} test accounts, ${rows} rows, ${files.total} receipts`);

// profile rows whose account no longer exists (an interrupted run deleted the account first)
const profiles = await db.listRows({ databaseId: 'main', tableId: 'users', queries: [Query.equal('is_seed', false), Query.limit(100)] });
let orphans = 0;
for (const p of profiles.rows) {
  const alive = await users.get({ userId: p.$id }).then(() => true, () => false);
  if (!alive) {
    await db.deleteRow({ databaseId: 'main', tableId: 'users', rowId: p.$id });
    orphans++;
  }
}
console.log(`removed ${orphans} orphaned profile rows`);

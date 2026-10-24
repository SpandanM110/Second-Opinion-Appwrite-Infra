// Recompute the fair ranges now (what the hourly schedule does), using a short-lived server key.
//   npm run stats            run it and print the summary
//   npm run stats -- --audit also report non-demo rows left in each table
import { Client, Functions, TablesDB, Query, ExecutionMethod } from 'node-appwrite';

const client = new Client().setEndpoint(process.env.APPWRITE_ENDPOINT).setProject(process.env.APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
const ex = await new Functions(client).createExecution({
  functionId: 'worker',
  // --empty sends what the hourly schedule sends: no body at all
  body: process.argv.includes('--empty') ? '' : JSON.stringify({ action: 'compute' }),
  async: false,
  method: ExecutionMethod.POST,
  headers: process.argv.includes('--empty') ? {} : { 'content-type': 'application/json' },
});
console.log(ex.status, ex.responseStatusCode, ex.responseBody);

if (process.argv.includes('--audit')) {
  const db = new TablesDB(client);
  for (const t of ['price_logs', 'confirmations', 'flags', 'quote_checks', 'replies', 'users']) {
    const r = await db.listRows({ databaseId: 'main', tableId: t, queries: [Query.equal('is_seed', false), Query.limit(1)] });
    console.log(t.padEnd(14), 'non-demo rows:', r.total);
  }
}
process.exit(ex.responseStatusCode === 200 ? 0 : 1);

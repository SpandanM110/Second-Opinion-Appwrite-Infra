import { Client, TablesDB, Query } from 'node-appwrite';

const DATABASE_ID = 'main';

// Day-1 skeleton: proves the schedule, the dynamic API key and TablesDB access work.
// Weights, percentiles, confidence and overcharge index land on Oct 27.
export default async ({ req, res, log }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']);
  const tablesDB = new TablesDB(client);

  const { total } = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: 'price_logs',
    queries: [Query.limit(1)],
  });

  log(`compute-stats ran: ${total} price_logs`);
  return res.json({ ok: true, priceLogs: total, ranAt: new Date().toISOString() });
};

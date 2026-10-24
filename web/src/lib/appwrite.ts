import { Account, Client, Functions, Storage, TablesDB, Query, type Models } from 'appwrite';

// Public identifiers, safe to ship to the browser.
export const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? 'https://sgp.cloud.appwrite.io/v1';
export const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? 'second-opinion';
export const FAIR_RANGE_URL = process.env.NEXT_PUBLIC_FAIR_RANGE_URL ?? 'https://6adcba4a001b8bfea9d0.appwrite.network';
export const DB = 'main';

export const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
export const tables = new TablesDB(client);
export const account = new Account(client);
export const functions = new Functions(client);
export const storage = new Storage(client);
export const RECEIPTS_BUCKET = 'receipts';

export async function listRows<T>(tableId: string, queries: string[] = []): Promise<T[]> {
  const res = await tables.listRows<Models.DefaultRow>({ databaseId: DB, tableId, queries });
  return res.rows as unknown as T[];
}

export async function listAll<T>(tableId: string, queries: string[] = []): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: T[] = await listRows<T>(tableId, [...queries, Query.limit(500), ...(cursor ? [Query.cursorAfter(cursor)] : [])]);
    out.push(...page);
    if (page.length < 500) return out;
    cursor = (page[page.length - 1] as { $id: string }).$id;
  }
}

export async function getRow<T>(tableId: string, rowId: string): Promise<T> {
  return (await tables.getRow({ databaseId: DB, tableId, rowId })) as unknown as T;
}

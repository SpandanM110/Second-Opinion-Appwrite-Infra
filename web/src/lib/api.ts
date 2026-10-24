import { AppwriteException, ExecutionMethod } from 'appwrite';
import { functions } from './appwrite';

// Every write goes through the `worker` Function: it learns who you are from your session, validates the
// input again, applies the daily limit and writes with its own key. The browser never writes price rows.

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
  ) {
    super(message);
  }
  /** Offline or unreachable: worth queueing for later, unlike a rejected price. */
  get retryable() {
    return this.code === 'offline';
  }
}

export async function callWorker<T extends object = Record<string, never>>(body: Record<string, unknown>): Promise<T> {
  let ex;
  try {
    ex = await functions.createExecution({
      functionId: 'worker',
      body: JSON.stringify(body),
      async: false,
      xpath: '/',
      method: ExecutionMethod.POST,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    if (e instanceof AppwriteException && e.code) {
      if (e.code === 401) throw new ApiError('signed_out', 'Your session ended. Please sign in again.', 401);
      if (e.code === 429) throw new ApiError('rate_limited', 'Too many requests. Wait a minute and try again.', 429);
      throw new ApiError('server', 'Something went wrong on our side. Try again in a moment.', e.code);
    }
    throw new ApiError('offline', 'You seem to be offline.');
  }

  let json: { ok?: boolean; error?: { code: string; message: string } } = {};
  try {
    json = JSON.parse(ex.responseBody);
  } catch {
    /* handled below */
  }
  if (ex.status === 'failed' || !json.ok) {
    throw new ApiError(json.error?.code ?? 'server', json.error?.message ?? 'Something went wrong on our side. Try again in a moment.', ex.responseStatusCode);
  }
  return json as T;
}

/** Start the worker in the background so the first real action isn't slowed by a cold start. */
export function warmWorker() {
  void functions
    .createExecution({ functionId: 'worker', body: JSON.stringify({ action: 'ping' }), async: true, xpath: '/', method: ExecutionMethod.POST, headers: { 'content-type': 'application/json' } })
    .catch(() => {});
}

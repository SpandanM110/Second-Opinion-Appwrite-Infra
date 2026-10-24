import { ApiError, callWorker } from './api';
import { load, save } from './storage';

// A price entered with no signal is kept on the phone and sent when the connection returns.
// Receipts can't wait (a photo needs an upload first), so only receipt-less prices are queued.

const KEY = 'so.outbox.v1';
interface Queued { id: string; body: Record<string, unknown>; at: string }

export const outboxCount = () => load<Queued[]>(KEY, []).length;

export function enqueue(body: Record<string, unknown>) {
  save(KEY, [...load<Queued[]>(KEY, []), { id: crypto.randomUUID(), body, at: new Date().toISOString() }]);
}

let inFlight: Promise<{ sent: number; rejected: string[] }> | null = null;

/** Sends what it can. Returns how many went through and the messages for any the server rejected (dropped). One flush at a time. */
export function flushOutbox() {
  inFlight ??= doFlush().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doFlush(): Promise<{ sent: number; rejected: string[] }> {
  const queue = load<Queued[]>(KEY, []);
  const keep: Queued[] = [];
  const rejected: string[] = [];
  let sent = 0;
  for (const q of queue) {
    try {
      await callWorker(q.body);
      sent++;
    } catch (e) {
      if (e instanceof ApiError && (e.retryable || e.code === 'signed_out')) keep.push(q);
      else rejected.push(e instanceof Error ? e.message : 'A saved price was rejected.');
    }
  }
  save(KEY, keep);
  return { sent, rejected };
}

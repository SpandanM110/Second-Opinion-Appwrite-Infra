import { handleUser } from './actions.js';
import { runCompute } from './compute.js';

// One private Function, two jobs (the free plan allows two Functions; fair-range is the other):
//
//   • compute   scheduled hourly, or started by a server key right after a write. Recomputes price_stats,
//               counters and reputation from the raw rows. No user can start it.
//   • actions   every verified user write (log a price, confirm, flag, ask, reply …). Only reachable through
//               Appwrite's signed-in execution path (this Function has no public URL), so x-appwrite-user-id
//               can be trusted as the caller's identity.
export default async (context) => {
  const { req, res } = context;
  const body = safeJson(req.bodyText);
  const action = String(body?.action ?? '');
  const signedIn = Boolean(req.headers['x-appwrite-user-id']);

  if (action === 'ping') return res.json({ ok: true, pong: true });
  if (action === 'compute' || (!action && !signedIn)) {
    if (signedIn) return res.json({ ok: false, error: { code: 'forbidden', message: 'Not allowed.' } }, 403);
    return runCompute(context);
  }
  return handleUser(context);
};

function safeJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

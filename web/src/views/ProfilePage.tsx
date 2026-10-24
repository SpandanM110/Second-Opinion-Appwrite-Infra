'use client';

import { MapPin } from 'lucide-react';
import { LogRow } from '../components/LogRow';
import { ErrorState, ListSkeleton } from '../components/States';
import { monthYear } from '../lib/format';
import { fetchUser, fetchUserLogs } from '../lib/queries';
import { useRefData } from '../lib/ref';
import type { UserRow } from '../lib/types';
import { useAsync } from '../lib/useAsync';

/** Minimal profile (F8): home city, reputation, logs, confirmations received, member since. */
export function ProfilePage({ id }: { id: string }) {
  const ref = useRefData();
  const q = useAsync(async () => {
    const [user, logs] = await Promise.all([fetchUser(id), fetchUserLogs(id)]);
    return { user, logs };
  }, [id]);

  if (q.status === 'error') return <ErrorState message="Couldn’t load this profile." onRetry={q.reload} />;
  if (!q.data) return <ListSkeleton rows={5} />;
  const { user, logs } = q.data;
  const home = ref.city(user.home_city_id);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="panel p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[22px] font-bold text-accent-ink" aria-hidden>
            {user.display_name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-bold">{user.display_name}</h1>
            <p className="flex flex-wrap items-center gap-x-2 text-[14px] text-muted">
              {home && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} aria-hidden /> {home.name}
                </span>
              )}
              <span>Member since {monthYear(user.$createdAt)}</span>
              {user.is_seed && <span className="rounded-full bg-low-soft px-2 py-px text-[12px] font-semibold text-low">demo account</span>}
            </p>
          </div>
        </div>

        <Reputation user={user} />

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ['Prices shared', user.log_count],
            ['Confirmed by others', user.confirmations_received],
            ['Flags received', user.flags_received],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-canvas px-2 py-3">
              <dd className="num text-[22px] font-bold">{v}</dd>
              <dt className="text-[12px] leading-tight text-muted">{k}</dt>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel px-4" aria-labelledby="their-logs">
        <h2 id="their-logs" className="pt-4 text-[16px] font-semibold">
          Recent prices
        </h2>
        <ul className="divide-y divide-line">
          {logs.map((l) => (
            <LogRow key={l.$id} log={l} showItem />
          ))}
        </ul>
      </section>
    </div>
  );
}

export function Reputation({ user }: { user: UserRow }) {
  const pct = ((user.reputation - 0.2) / (3 - 0.2)) * 100;
  const label = user.reputation >= 2 ? 'Trusted local' : user.reputation >= 1 ? 'Good standing' : 'Under review';
  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[14px] font-semibold">
          Reputation <span className="num">{user.reputation.toFixed(1)}</span>
          <span className="font-normal text-muted"> · {label}</span>
        </p>
        <p className="text-[12px] text-faint">0.2 – 3.0</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="meter" aria-valuemin={0.2} aria-valuemax={3} aria-valuenow={user.reputation} aria-label="Reputation">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(3, pct)}%` }} />
      </div>
      <p className="mt-2 text-[13px] text-muted">
        Goes up 0.1 each time a neighbour confirms one of their prices, down 0.3 for each flag. Higher reputation moves the range more.
        {user.log_count < 10 && ' New accounts count at half weight until their 10th price.'}
      </p>
    </div>
  );
}

'use client';

import { useQueryState } from '../lib/nav';
import { LogRow, PriceTypeHelp } from '../components/LogRow';
import { QuoteCheckItem } from '../components/QuoteCheckItem';
import { Empty, ErrorState, ListSkeleton } from '../components/States';
import { useOnChange } from '../lib/events';
import { usePlace } from '../lib/place';
import { fetchQuoteChecks, fetchRecentLogs, fetchUsers } from '../lib/queries';
import { useRefData } from '../lib/ref';
import { useAsync } from '../lib/useAsync';

const TABS = [
  { key: 'questions', label: 'Is this fair?' },
  { key: 'logs', label: 'Recent prices' },
] as const;

/** What's happening in this city: questions from newcomers and the latest prices paid. */
export function FeedPage() {
  const ref = useRefData();
  const place = usePlace();
  const [params, setParams] = useQueryState();
  const tab = params.get('tab') === 'logs' ? 'logs' : 'questions';
  const cityId = ref.city(params.get('city'))?.$id ?? place.city?.$id ?? 'bhopal';
  const city = ref.city(cityId);

  const qcQ = useAsync(async () => {
    if (tab !== 'questions') return null;
    const qcs = await fetchQuoteChecks(cityId);
    return { qcs, users: await fetchUsers(qcs.map((q) => q.user_id)) };
  }, [cityId, tab]);

  const logsQ = useAsync(async () => {
    if (tab !== 'logs') return null;
    const logs = await fetchRecentLogs({ cityId, limit: 40 });
    return { logs, users: await fetchUsers(logs.map((l) => l.user_id)) };
  }, [cityId, tab]);

  useOnChange(() => {
    qcQ.reload();
    logsQ.reload();
  });

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    setParams(next);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight sm:text-[28px]">{city?.name ?? ''} feed</h1>
          <p className="mt-1 text-[15px] text-muted">Newcomers ask if a quote is fair; locals answer and share what they paid.</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-surface p-1 shadow-sm" role="group" aria-label="City">
          {ref.cities.map((c) => (
            <button
              key={c.$id}
              type="button"
              aria-pressed={c.$id === cityId}
              onClick={() => setParam('city', c.$id)}
              className={`tap rounded-lg px-3 text-[14px] font-semibold ${c.$id === cityId ? 'bg-accent text-white' : 'text-muted hover:bg-canvas'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-5 flex border-b border-line" role="tablist" aria-label="Feed">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setParam('tab', t.key)}
            className={`tap -mb-px border-b-2 px-4 text-[15px] font-semibold ${tab === t.key ? 'border-accent text-accent-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-4" role="tabpanel">
        {tab === 'questions' && (
          <>
            {qcQ.status === 'loading' && !qcQ.data && <ListSkeleton />}
            {qcQ.status === 'error' && <ErrorState onRetry={qcQ.reload} />}
            {qcQ.data && qcQ.data.qcs.length === 0 && <Empty title={`No questions in ${city?.name} yet`}>Got a quote that feels off? Ask locals from any price card.</Empty>}
            {qcQ.data && (
              <ul className="space-y-3">
                {qcQ.data.qcs.map((q) => (
                  <QuoteCheckItem key={q.$id} qc={q} asker={qcQ.data!.users.get(q.user_id)} />
                ))}
              </ul>
            )}
          </>
        )}
        {tab === 'logs' && (
          <section className="panel px-4">
            <div className="pt-3">
              <PriceTypeHelp />
            </div>
            {logsQ.status === 'loading' && !logsQ.data && <ListSkeleton rows={6} />}
            {logsQ.status === 'error' && (
              <div className="py-4">
                <ErrorState onRetry={logsQ.reload} />
              </div>
            )}
            {logsQ.data && (
              <ul className="divide-y divide-line">
                {logsQ.data.logs.map((l) => (
                  <LogRow key={l.$id} log={l} author={logsQ.data!.users.get(l.user_id)} showItem />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

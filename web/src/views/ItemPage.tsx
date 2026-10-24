'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Code2, Copy, Check } from 'lucide-react';
import { FairRangeCard } from '../components/FairRangeCard';
import { LogRow } from '../components/LogRow';
import { PlaceChip } from '../components/PlacePicker';
import { SignInSheet } from '../components/SignInSheet';
import { CardSkeleton, Empty, ErrorState, ListSkeleton } from '../components/States';
import { FAIR_RANGE_URL } from '../lib/appwrite';
import { usePlace } from '../lib/place';
import { fetchCard, fetchRecentLogs, fetchUsers, type CardResult } from '../lib/queries';
import { pushRecent } from '../lib/recent';
import { useRefData } from '../lib/ref';
import type { PriceLog, UserRow } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { NotFound } from './NotFound';

/** Server-rendered first paint for one place; reused only while the client is still on that place. */
export interface ItemInitial { placeKey: string; card: CardResult; logs: PriceLog[]; users: UserRow[] }

export function ItemPage({ itemId, initial }: { itemId: string; initial?: ItemInitial }) {
  const params = useSearchParams();
  const router = useRouter();
  const ref = useRefData();
  const place = usePlace();
  const [signIn, setSignIn] = useState<string | null>(null);

  // A shared link (?c=&l=) shows that place; otherwise the user's current place.
  const item = ref.item(itemId);
  const urlCity = ref.city(params.get('c'));
  const city = urlCity ?? place.city;
  const locality = urlCity ? ref.locality(params.get('l')) : place.locality;
  const category = item ? ref.categoryOf(item) : undefined;

  useEffect(() => {
    if (item) pushRecent(item.$id);
  }, [item]);

  const placeKey = `${city?.$id}|${locality?.$id ?? ''}`;
  const seed = initial?.placeKey === placeKey ? initial : undefined;

  const cardQ = useAsync(
    () => (item && city ? fetchCard(item, category, city, locality) : Promise.reject(new Error('not ready'))),
    [item?.$id, city?.$id, locality?.$id],
    seed?.card,
  );
  const card = cardQ.data?.card;
  const scopeLocality = card?.status === 'ok' && card.scope.type === 'locality' ? locality?.$id : null;

  const logsQ = useAsync(async () => {
    if (!item || !city) return { logs: [], users: new Map() };
    const logs = await fetchRecentLogs({ itemId: item.$id, cityId: city.$id, localityId: scopeLocality, limit: 5 });
    return { logs, users: await fetchUsers(logs.map((l) => l.user_id)) };
  }, [item?.$id, city?.$id, scopeLocality], seed ? { logs: seed.logs, users: new Map(seed.users.map((u) => [u.$id, u])) } : undefined);

  if (ref.ready && !item) return <NotFound what="item" />;

  const apiUrl = item && city ? `${FAIR_RANGE_URL}/?item=${item.$id}${locality ? `&locality=${locality.$id}` : `&city=${city.$id}`}` : '';

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/" className="tap -ml-2 inline-flex items-center gap-1 rounded-lg px-2 text-[15px] font-medium text-muted hover:text-ink">
          <ArrowLeft size={18} aria-hidden /> All items
        </Link>
        {!urlCity && <PlaceChip />}
        {urlCity && (
          <p className="text-[14px] text-muted">
            Shared link: {locality ? `${locality.name}, ` : ''}
            {urlCity.name}.{' '}
            <Link href={`/item/${itemId}`} className="font-semibold text-accent-ink underline">
              Use my area
            </Link>
          </p>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-start">
        <div className="space-y-3">
          {!card && cardQ.status === 'loading' && <CardSkeleton />}
          {!card && cardQ.status === 'error' && ref.ready && <ErrorState message="Couldn’t load the fair range." onRetry={cardQ.reload} />}
          {card && (
            <FairRangeCard
              card={card}
              staleSince={cardQ.data?.stale ? cardQ.data.fetchedAt : undefined}
              actions={{
                onPaid: () => setSignIn('paid'),
                onAsk: () => setSignIn('ask'),
                onCompare: () => router.push(`/compare/${itemId}${city ? `?a=${city.$id}` : ''}`),
              }}
            />
          )}
        </div>

        <aside className="space-y-4">
          <section className="panel p-4" aria-labelledby="recent-logs">
            <div className="flex items-baseline justify-between">
              <h2 id="recent-logs" className="text-[16px] font-semibold">
                Recent logs {scopeLocality && locality ? `in ${locality.name}` : city ? `in ${city.name}` : ''}
              </h2>
              <Link href="/feed?tab=logs" className="tap inline-flex items-center justify-end text-[14px] font-semibold text-accent-ink hover:underline">
                See all
              </Link>
            </div>
            {logsQ.status === 'loading' && !logsQ.data && <ListSkeleton rows={3} />}
            {logsQ.status === 'error' && <p className="py-3 text-[14px] text-muted">Couldn’t load recent logs.</p>}
            {logsQ.data && logsQ.data.logs.length === 0 && (
              <div className="pt-3">
                <Empty title="No logs here yet">Be the first to log what you paid.</Empty>
              </div>
            )}
            {logsQ.data && logsQ.data.logs.length > 0 && (
              <ul className="divide-y divide-line">
                {logsQ.data.logs.map((l) => (
                  <LogRow key={l.$id} log={l} author={logsQ.data!.users.get(l.user_id)} hideLocality={Boolean(scopeLocality)} />
                ))}
              </ul>
            )}
          </section>

          {apiUrl && <ApiSnippet url={apiUrl} />}
        </aside>
      </div>

      <SignInSheet open={signIn !== null} onClose={() => setSignIn(null)} reason={signIn ?? undefined} />
    </div>
  );
}

function ApiSnippet({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="rounded-2xl bg-ink p-4 text-white" aria-labelledby="api-title">
      <h2 id="api-title" className="flex items-center gap-2 text-[14px] font-semibold">
        <Code2 size={16} aria-hidden /> Same answer, as an API
      </h2>
      <p className="mt-1 text-[13px] text-white/70">Any app or AI assistant can ask Second Opinion directly.</p>
      <div className="mt-3 flex items-stretch gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-white/10 px-3 py-2 text-[12px]">curl "{url}"</code>
        <button
          type="button"
          className="tap inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
          aria-label="Copy curl command"
          onClick={() => {
            navigator.clipboard?.writeText(`curl "${url}"`).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
    </section>
  );
}

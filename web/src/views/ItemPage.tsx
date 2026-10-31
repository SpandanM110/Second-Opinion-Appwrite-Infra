'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Code2, Copy, Check, MapPin } from 'lucide-react';
import { CardGuide } from '../components/CardGuide';
import { FairRangeCard } from '../components/FairRangeCard';
import { LogRow, PriceTypeHelp } from '../components/LogRow';
import { PlacePicker } from '../components/PlacePicker';
import { CardSkeleton, Empty, ErrorState, ListSkeleton } from '../components/States';
import { useAppBar } from '../lib/appbar';
import { FAIR_RANGE_URL } from '../lib/appwrite';
import { useContribute } from '../lib/contribute';
import { useOnChange } from '../lib/events';
import { usePlace } from '../lib/place';
import { fetchCard, fetchRecentPrices, fetchUsers, type CardResult } from '../lib/queries';
import { pushRecent } from '../lib/recent';
import { useRefData } from '../lib/ref';
import type { PriceLog, UserRow } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { NotFound } from './NotFound';

/** Server-rendered first paint for one place; reused only while the client is still on that place. */
export interface ItemInitial { placeKey: string; card: CardResult; logs: PriceLog[]; users: UserRow[]; guideDismissed: boolean }

export function ItemPage({ itemId, initial }: { itemId: string; initial?: ItemInitial }) {
  const params = useSearchParams();
  const router = useRouter();
  const ref = useRefData();
  const place = usePlace();
  const contribute = useContribute();
  const [pickOpen, setPickOpen] = useState(false);
  // The bar offers the area picker; a shared link shows its own place and offers "Use my area" instead.
  const urlCityId = params.get('c');
  useAppBar(
    {
      back: '/check',
      action: urlCityId ? undefined : (
        <button type="button" onClick={() => setPickOpen(true)} className="tap -mr-2 inline-flex items-center justify-center rounded-lg text-accent-ink hover:bg-canvas" aria-label="Change area">
          <MapPin size={22} aria-hidden />
        </button>
      ),
    },
    [urlCityId],
  );

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
    const logs = await fetchRecentPrices({ itemId: item.$id, cityId: city.$id, localityId: scopeLocality });
    return { logs, users: await fetchUsers(logs.map((l) => l.user_id)) };
  }, [item?.$id, city?.$id, scopeLocality], seed ? { logs: seed.logs, users: new Map(seed.users.map((u) => [u.$id, u])) } : undefined);

  // A price, confirmation or flag was just saved: refetch what is on screen. It fires again a few seconds later,
  // once the fair range has been recomputed.
  useOnChange(() => {
    cardQ.reload();
    logsQ.reload();
  });

  if (ref.ready && !item) return <NotFound what="item" />;

  const apiUrl = item && city ? `${FAIR_RANGE_URL}/?item=${item.$id}${locality ? `&locality=${locality.$id}` : `&city=${city.$id}`}` : '';

  return (
    <div className="mx-auto max-w-5xl">
      {urlCity && (
        <p className="mb-4 text-[14px] text-muted">
          Shared link: {locality ? `${locality.name}, ` : ''}
          {urlCity.name}.{' '}
          <Link href={`/item/${itemId}`} className="font-semibold text-accent-ink underline">
            Use my area
          </Link>
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-start">
        <div className="space-y-3">
          {!card && cardQ.status === 'loading' && <CardSkeleton />}
          {!card && cardQ.status === 'error' && ref.ready && <ErrorState message="Couldn’t load the fair range." onRetry={cardQ.reload} />}
          {card && (
            <FairRangeCard
              card={card}
              staleSince={cardQ.data?.stale ? cardQ.data.fetchedAt : undefined}
              guide={card.status === 'ok' ? <CardGuide defaultOpen={!(initial?.guideDismissed ?? true)} /> : undefined}
              actions={{
                onPaid: () => void contribute.openLog(itemId),
                onAsk: () => void contribute.openAsk(itemId),
                onCompare: () => router.push(`/compare/${itemId}${city ? `?a=${city.$id}` : ''}`),
                onPickArea: urlCity ? undefined : () => setPickOpen(true),
              }}
            />
          )}
          {!urlCity && <PlacePicker open={pickOpen} onClose={() => setPickOpen(false)} />}
        </div>

        <aside className="space-y-4">
          <section className="panel p-4" aria-labelledby="recent-logs">
            <div className="flex items-baseline justify-between">
              <h2 id="recent-logs" className="text-[16px] font-semibold">
                Recent prices {scopeLocality && locality ? `in ${locality.name}` : city ? `in ${city.name}` : ''}
              </h2>
              <Link href="/feed?tab=logs" className="tap inline-flex items-center justify-end text-[14px] font-semibold text-accent-ink hover:underline">
                See all
              </Link>
            </div>
            {logsQ.status === 'loading' && !logsQ.data && <ListSkeleton rows={3} />}
            {logsQ.status === 'error' && <p className="py-3 text-[14px] text-muted">Couldn’t load recent prices.</p>}
            {logsQ.data && logsQ.data.logs.length === 0 && (
              <div className="pt-3">
                <Empty title="No prices here yet">Be the first to share what you paid.</Empty>
              </div>
            )}
            {logsQ.data && logsQ.data.logs.length > 0 && (
              <>
                <div className="mt-2">
                  <PriceTypeHelp />
                </div>
                <ul className="divide-y divide-line">
                  {logsQ.data.logs
                    .filter((l) => l.price_type !== 'quoted')
                    .map((l) => (
                      <LogRow key={l.$id} log={l} author={logsQ.data!.users.get(l.user_id)} hideLocality={Boolean(scopeLocality)} />
                    ))}
                </ul>
                {logsQ.data.logs.some((l) => l.price_type === 'quoted') && (
                  <div className="mt-3 rounded-xl bg-medium-soft/50 px-3 pb-1 pt-3">
                    <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-medium">
                      <AlertTriangle size={15} aria-hidden />
                      {card?.status === 'ok' && card.overcharge ? `First quotes here: ${card.overcharge.index.toFixed(1)}x the fair price` : 'First quotes people were given here'}
                    </h3>
                    <p className="text-[12px] text-muted">Not fair prices: what sellers asked before any bargaining.</p>
                    <ul className="divide-y divide-line/70">
                      {logsQ.data.logs
                        .filter((l) => l.price_type === 'quoted')
                        .map((l) => (
                          <LogRow key={l.$id} log={l} author={logsQ.data!.users.get(l.user_id)} hideLocality={Boolean(scopeLocality)} />
                        ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

          {apiUrl && <ApiSnippet url={apiUrl} />}
        </aside>
      </div>

    </div>
  );
}

function ApiSnippet({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="rounded-2xl border border-line bg-panel p-4 text-panel-ink" aria-labelledby="api-title">
      <h2 id="api-title" className="flex items-center gap-2 text-[14px] font-semibold">
        <Code2 size={16} aria-hidden /> Same answer, as an API
      </h2>
      <p className="mt-1 text-[13px] text-panel-ink/75">Any app or AI assistant can ask Second Opinion directly.</p>
      <div className="mt-3 flex items-stretch gap-2">
        <code tabIndex={0} className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-panel-ink/10 px-3 py-2 text-[12px]">curl "{url}"</code>
        <button
          type="button"
          className="tap inline-flex items-center justify-center rounded-lg bg-panel-ink/10 hover:bg-panel-ink/20"
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

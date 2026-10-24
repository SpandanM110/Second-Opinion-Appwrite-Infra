'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, ChevronRight, Clock, LocateFixed, Loader2 } from 'lucide-react';
import { UNIT_LABEL } from '../core/card.js';
import { CategoryIcon } from '../components/CategoryIcon';
import { ConfidenceDot } from '../components/ConfidenceBadge';
import { ItemSearch } from '../components/ItemSearch';
import { PlaceChip } from '../components/PlacePicker';
import { Price } from '../components/Price';
import { usePlace } from '../lib/place';
import { fetchCityStats } from '../lib/queries';
import { recentItems } from '../lib/recent';
import { useRefData } from '../lib/ref';
import type { Item, PriceStat } from '../lib/types';
import { useAsync } from '../lib/useAsync';

export function CheckPage({ initialStats }: { initialStats?: { cityId: string; rows: PriceStat[] } }) {
  const ref = useRefData();
  const place = usePlace();
  const cityId = place.city?.$id;
  const statsQ = useAsync(
    () => (cityId ? fetchCityStats([cityId]) : Promise.resolve([] as PriceStat[])),
    [cityId],
    initialStats && initialStats.cityId === cityId ? initialStats.rows : undefined,
  );
  const stats = useMemo(() => new Map((statsQ.data ?? []).map((s) => [s.item_id, s])), [statsQ.data]);
  // Recents live in localStorage, so they appear after hydration.
  const [recents, setRecents] = useState<Item[]>([]);
  useEffect(() => setRecents(recentItems().map((id) => ref.item(id)).filter((x) => x !== undefined)), [ref]);

  return (
    <div className="mx-auto max-w-3xl">
      <section className="pb-6 pt-2 sm:pt-6">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[36px]">Check before you pay.</h1>
        <p className="mt-1 text-[16px] text-muted sm:text-[18px]">What locals really paid, near you, this month.</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <PlaceChip />
          {place.source === 'default' && (
            <button type="button" onClick={place.locate} className="btn-ghost h-11 px-3 text-[14px]" disabled={place.status === 'locating'}>
              {place.status === 'locating' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <LocateFixed size={16} aria-hidden />}
              Use my location
            </button>
          )}
        </div>
        {place.status === 'denied' && <p className="mt-2 text-[13px] text-muted">Location is off. Tap the area chip to pick where you are.</p>}
        {place.status === 'outside' && <p className="mt-2 text-[13px] text-muted">We cover Bhopal, Indore and Mumbai for now. Showing {place.city?.name}.</p>}

        <div className="mt-4">
          <ItemSearch cityStats={stats} />
        </div>

        {recents.length > 0 && (
          <div className="mt-4">
            <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-muted">
              <Clock size={14} aria-hidden /> Recent
            </h2>
            <div className="flex flex-wrap gap-2">
              {recents.map((it) => (
                <Link key={it.$id} href={`/item/${it.$id}`} className="tap inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 text-[14px] font-medium hover:bg-canvas">
                  <CategoryIcon categoryId={it.category_id} size={16} className="text-muted" />
                  {it.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="popular" className="space-y-6">
        <div className="flex items-end justify-between gap-2">
          <h2 id="popular" className="text-[18px] font-semibold">
            Typical prices in {place.city?.name ?? '…'}
          </h2>
          <Link href="/compare" className="tap inline-flex items-center gap-1 text-[14px] font-semibold text-accent-ink hover:underline">
            <ArrowLeftRight size={15} aria-hidden /> Compare cities
          </Link>
        </div>
        {!ref.ready && <GridSkeleton />}
        {ref.categories.map((cat) => {
          const items = ref.items.filter((i) => i.category_id === cat.$id);
          return (
            <div key={cat.$id}>
              <h3 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-muted">
                <CategoryIcon categoryId={cat.$id} size={16} /> {cat.name}
              </h3>
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
                {items.map((it) => {
                  const s = stats.get(it.$id);
                  return (
                    <li key={it.$id}>
                      <Link href={`/item/${it.$id}`} className="panel tap flex items-center gap-3 px-3 py-2.5 transition-shadow hover:shadow-md">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium">{it.name}</span>
                          <span className="text-[13px] text-faint">{UNIT_LABEL[it.unit]}</span>
                        </span>
                        {s ? (
                          <span className="flex items-center gap-2">
                            <ConfidenceDot level={s.confidence} />
                            <Price value={s.median} size="md" />
                          </span>
                        ) : statsQ.status === 'loading' ? (
                          <span className="skeleton h-5 w-12" />
                        ) : (
                          <span className="text-[13px] text-faint">no data yet</span>
                        )}
                        <ChevronRight size={18} className="shrink-0 text-faint" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-3" aria-label="How it works">
        {[
          ['Check', 'See the fair range for this exact item, in this exact area, before you pay.'],
          ['Log', 'Tell us what you actually paid. Receipts and a good track record count for more.'],
          ['Verify', 'Locals confirm or flag numbers. Three flags and a bad number is out.'],
        ].map(([t, d], i) => (
          <div key={t} className="rounded-2xl bg-surface/60 p-4">
            <p className="text-[13px] font-semibold text-accent-ink">
              {i + 1}. {t}
            </p>
            <p className="mt-1 text-[14px] text-muted">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2" aria-busy="true" aria-label="Loading items">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="skeleton h-[60px] rounded-2xl" />
      ))}
    </div>
  );
}

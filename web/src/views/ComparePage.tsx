'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryState } from '../lib/nav';
import { Query } from 'appwrite';
import { buildCard, stateIdOf, UNIT_LABEL } from '../core/card.js';
import { MiniCard } from '../components/FairRangeCard';
import { Price } from '../components/Price';
import { ErrorState } from '../components/States';
import { listRows } from '../lib/appwrite';
import { ratioLine } from '../lib/format';
import { usePlace } from '../lib/place';
import { fetchCityStats } from '../lib/queries';
import { useRefData } from '../lib/ref';
import type { Card, City, PriceStat } from '../lib/types';
import { useAsync } from '../lib/useAsync';

/** City vs city: always city scope on both sides, so the two numbers are like for like. */
export function ComparePage({ itemId = 'auto-per-km' }: { itemId?: string }) {
  const [params, setParams] = useQueryState();
  const router = useRouter();
  const ref = useRefData();
  const place = usePlace();

  const a = place.city ?? ref.city('bhopal');
  const b = ref.city(params.get('b')) ?? ref.cities.find((c) => c.$id !== a?.$id && c.$id === 'mumbai') ?? ref.cities.find((c) => c.$id !== a?.$id);
  const item = ref.item(itemId);

  const cardsQ = useAsync(async () => {
    if (!item || !a || !b) return null;
    const states = [...new Set([a, b].map(stateIdOf))];
    const rows = await listRows<PriceStat>('price_stats', [Query.equal('item_id', item.$id), Query.equal('scope_id', [a.$id, b.$id, ...states]), Query.limit(10)]);
    const cat = ref.categoryOf(item);
    const mk = (c: typeof a) => buildCard({ item, hyperlocal: cat?.hyperlocal ?? true, city: c, locality: null, rows }) as Card;
    return { a: mk(a), b: mk(b) };
  }, [item?.$id, a?.$id, b?.$id]);

  const allQ = useAsync(() => (a && b ? fetchCityStats([a.$id, b.$id]) : Promise.resolve([])), [a?.$id, b?.$id]);
  const table = useMemo(() => {
    const by = new Map((allQ.data ?? []).map((s) => [`${s.item_id}|${s.scope_id}`, s]));
    return ref.items.map((it) => ({ it, sa: by.get(`${it.$id}|${a?.$id}`), sb: by.get(`${it.$id}|${b?.$id}`) }));
  }, [allQ.data, ref.items, a?.$id, b?.$id]);

  const set = (key: 'b', v: string) => {
    const next = new URLSearchParams(params);
    next.set(key, v);
    setParams(next);
  };

  const ca = cardsQ.data?.a;
  const cb = cardsQ.data?.b;
  const comparable = ca?.status === 'ok' && cb?.status === 'ok' && ca.scope.type === 'city' && cb.scope.type === 'city' && ca.confidence.level !== 'low' && cb.confidence.level !== 'low';
  const whyNot = !ca || !cb ? null : ca.status !== 'ok' || cb.status !== 'ok' ? 'One city has no data for this yet.' : !comparable ? 'One side has too little city data for a fair comparison.' : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-[24px] font-bold tracking-tight sm:text-[28px]">Compare cities</h1>
        <p className="mt-1 text-[15px] text-muted">Moving or travelling? Your area sets the first city; pick the one to compare it with.</p>
      </header>

      <div className="panel space-y-3 p-4">
        <label className="block">
          <span className="mb-1 block text-[13px] font-semibold text-muted">Item</span>
          <select
            value={itemId}
            onChange={(e) => router.replace(`/compare/${e.target.value}?${params.toString()}`, { scroll: false })}
            className="tap w-full rounded-xl border border-line bg-surface px-3 text-[16px]"
          >
            {ref.categories.map((cat) => (
              <optgroup key={cat.$id} label={cat.name}>
                {ref.items
                  .filter((i) => i.category_id === cat.$id)
                  .map((i) => (
                    <option key={i.$id} value={i.$id}>
                      {i.name} ({UNIT_LABEL[i.unit]})
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <CitySelect cities={ref.cities.filter((c) => c.$id !== a?.$id)} label={`Compared with ${a?.name ?? ''}`} value={b?.$id} onChange={(v) => set('b', v)} />
      </div>

      {cardsQ.status === 'error' && <ErrorState onRetry={cardsQ.reload} />}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {[ca, cb].map((c, i) => {
          const city = i === 0 ? a : b;
          return c ? (
            <MiniCard key={i} card={c} title={city?.name} />
          ) : (
            <div key={i} className="panel h-[188px] p-4">
              <div className="skeleton h-4 w-20" />
              <div className="skeleton mt-4 h-8 w-24" />
              <div className="skeleton mt-3 h-4 w-28" />
            </div>
          );
        })}
      </div>

      <p className="-mt-3 text-center text-[12px] text-faint">The badge on each card shows how much to trust that city's number.</p>

      {ca?.status === 'ok' && cb?.status === 'ok' && a && b && (
        <p className={`rounded-xl px-4 py-3 text-center text-[16px] ${comparable ? 'bg-accent-soft font-semibold text-accent-ink' : 'bg-low-soft text-low'}`} role="status">
          {comparable ? ratioLine(ca.range.median, cb.range.median, a.name, b.name) : whyNot}
        </p>
      )}
      {whyNot && !(ca?.status === 'ok' && cb?.status === 'ok') && <p className="rounded-xl bg-low-soft px-4 py-3 text-center text-[15px] text-low">{whyNot}</p>}

      <section aria-labelledby="all-items" className="panel overflow-hidden">
        <h2 id="all-items" className="border-b border-line px-4 py-3 text-[16px] font-semibold">
          Everything, {a?.name} vs {b?.name}
        </h2>
        <table className="w-full text-[14px]">
          <thead className="bg-canvas text-left text-[12px] uppercase tracking-wide text-faint">
            <tr>
              <th scope="col" className="px-4 py-2 font-semibold">Item</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">{a?.name}</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">{b?.name}</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Ratio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {table.map(({ it, sa, sb }) => {
              const r = sa && sb ? sb.median / sa.median : null;
              return (
                <tr key={it.$id} className={it.$id === itemId ? 'bg-accent-soft/50' : ''}>
                  <th scope="row" className="px-4 py-2 text-left font-medium">
                    <Link href={`/compare/${it.$id}?${params.toString()}`} replace scroll={false} className="hover:underline">
                      {it.name}
                    </Link>
                    <span className="block text-[12px] font-normal text-faint">{UNIT_LABEL[it.unit]}</span>
                  </th>
                  <td className="px-2 py-2 text-right">{sa ? <Price value={sa.median} size="sm" /> : <span className="text-faint">–</span>}</td>
                  <td className="px-2 py-2 text-right">{sb ? <Price value={sb.median} size="sm" /> : <span className="text-faint">–</span>}</td>
                  <td className={`num px-4 py-2 text-right font-semibold ${r && r >= 1.5 ? 'text-warn' : r && r <= 0.67 ? 'text-high' : 'text-muted'}`}>{r ? `${r.toFixed(1)}x` : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function CitySelect({ cities, label, value, onChange }: { cities: City[]; label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block truncate text-[13px] font-semibold text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="tap w-full rounded-xl border border-line bg-surface px-2 text-[16px]">
        {cities.map((c) => (
          <option key={c.$id} value={c.$id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

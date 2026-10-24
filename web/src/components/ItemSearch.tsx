'use client';

import { useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { UNIT_LABEL } from '../core/card.js';
import { useRefData } from '../lib/ref';
import type { Item, PriceStat } from '../lib/types';
import { CategoryIcon } from './CategoryIcon';
import { ConfidenceDot } from './ConfidenceBadge';
import { Price } from './Price';

/** The home screen's one job: a big search box. Matches names, aliases and Hindi names. */
export function ItemSearch({ cityStats, onPick }: { cityStats: Map<string, PriceStat>; onPick?: (item: Item) => void }) {
  const ref = useRefData();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const results = useMemo(() => ref.searchItems(q).slice(0, 8), [ref, q]);

  const go = (item: Item) => {
    onPick?.(item);
    router.push(`/item/${item.$id}`);
  };

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search for an item
      </label>
      <Search size={20} className="pointer-events-none absolute left-4 top-[26px] -translate-y-1/2 text-faint" aria-hidden />
      <input
        id={`${listId}-input`}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1));
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          else if (e.key === 'Enter' && results[active]) go(results[active]);
          else if (e.key === 'Escape') setQ('');
          else return;
          e.preventDefault();
        }}
        placeholder="Auto, plumber, haircut, chai…"
        autoComplete="off"
        enterKeyHint="search"
        role="combobox"
        aria-expanded={q.trim().length > 0}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={results[active] ? `${listId}-${results[active].$id}` : undefined}
        className="h-[52px] w-full rounded-2xl border border-line bg-surface pl-12 pr-12 text-[17px] shadow-sm outline-none placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent/10"
      />
      {q && (
        <button type="button" onClick={() => setQ('')} className="tap absolute right-1 top-[26px] flex -translate-y-1/2 items-center justify-center text-faint" aria-label="Clear search">
          <X size={18} />
        </button>
      )}
      {q.trim() && (
        <ul id={listId} role="listbox" className="panel absolute inset-x-0 top-[60px] z-20 max-h-[60dvh] overflow-y-auto p-1 shadow-xl">
          {results.length === 0 && (
            <li className="px-3 py-4 text-[14px] text-muted">
              Nothing called “{q}” yet. Try “auto”, “plumber”, “haircut” or “chai”.
            </li>
          )}
          {results.map((it, i) => {
            const s = cityStats.get(it.$id);
            return (
              <li key={it.$id} id={`${listId}-${it.$id}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onClick={() => go(it)}
                  onMouseEnter={() => setActive(i)}
                  className={`tap flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${i === active ? 'bg-accent-soft' : ''}`}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-canvas text-muted">
                    <CategoryIcon categoryId={it.category_id} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{it.name}</span>
                    <span className="text-[13px] text-faint">{UNIT_LABEL[it.unit]}</span>
                  </span>
                  {s && (
                    <span className="flex items-center gap-1.5">
                      <ConfidenceDot level={s.confidence} />
                      <Price value={s.median} size="sm" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

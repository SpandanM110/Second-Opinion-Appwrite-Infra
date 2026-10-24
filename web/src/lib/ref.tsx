'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Category, City, Item, Locality } from './types';

// Reference data (cities, localities, categories, items) is fetched on the server, cached for
// 10 minutes, and handed to the browser with the first HTML, so no client round trip is needed.

export interface RefData { cities: City[]; localities: Locality[]; categories: Category[]; items: Item[] }
interface RefApi extends RefData {
  ready: boolean;
  error: string | null;
  city: (id: string | null | undefined) => City | undefined;
  locality: (id: string | null | undefined) => Locality | undefined;
  item: (id: string | null | undefined) => Item | undefined;
  categoryOf: (item: Item) => Category | undefined;
  localitiesIn: (cityId: string) => Locality[];
  searchItems: (q: string) => Item[];
}

const Ctx = createContext<RefApi | null>(null);

export function RefProvider({ data, children }: { data: RefData | null; children: ReactNode }) {
  const api = useMemo<RefApi>(() => {
    const d = data ?? { cities: [], localities: [], categories: [], items: [] };
    const byId = <T extends { $id: string }>(xs: T[]) => new Map(xs.map((x) => [x.$id, x]));
    const cities = byId(d.cities);
    const localities = byId(d.localities);
    const items = byId(d.items);
    const categories = byId(d.categories);
    return {
      ...d,
      ready: Boolean(data),
      error: data ? null : 'Could not reach the server. Check your connection and reload.',
      city: (id) => (id ? cities.get(id) : undefined),
      locality: (id) => (id ? localities.get(id) : undefined),
      item: (id) => (id ? items.get(id) : undefined),
      categoryOf: (item) => categories.get(item.category_id),
      localitiesIn: (cityId) => d.localities.filter((l) => l.city_id === cityId),
      searchItems: (q) => {
        const needle = q.trim().toLowerCase();
        if (!needle) return [];
        return d.items
          .map((it) => {
            const name = it.name.toLowerCase();
            const aliases = (it.aliases ?? []).map((a) => a.toLowerCase());
            let score = 0;
            if (name.startsWith(needle)) score = 4;
            else if (name.split(/[\s,()+-]+/).some((w) => w.startsWith(needle))) score = 3;
            else if (aliases.some((a) => a.startsWith(needle))) score = 2;
            else if (name.includes(needle) || aliases.some((a) => a.includes(needle))) score = 1;
            return { it, score };
          })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score || a.it.name.localeCompare(b.it.name))
          .map((x) => x.it);
      },
    };
  }, [data]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useRefData() {
  const v = useContext(Ctx);
  if (!v) throw new Error('RefProvider missing');
  return v;
}

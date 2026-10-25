'use client';

import { useMemo } from 'react';
import type { PriceStat } from '../../lib/types';
import { ItemSearch } from '../ItemSearch';

export function LandingSearch({ rows }: { rows: PriceStat[] }) {
  const stats = useMemo(() => new Map(rows.map((s) => [s.item_id, s])), [rows]);
  return <ItemSearch cityStats={stats} />;
}

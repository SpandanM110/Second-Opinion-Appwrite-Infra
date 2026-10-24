import type { PriceLog } from './types';

/** The latest 5 paid/listed prices plus up to 3 first quotes, newest first within each group. */
export function splitRecent(logs: PriceLog[]): PriceLog[] {
  return [...logs.filter((l) => l.price_type !== 'quoted').slice(0, 5), ...logs.filter((l) => l.price_type === 'quoted').slice(0, 3)];
}

import { load, save } from './storage';

const KEY = 'so.recent.v1';

export const recentItems = () => load<string[]>(KEY, []);

export function pushRecent(itemId: string) {
  save(KEY, [itemId, ...recentItems().filter((x) => x !== itemId)].slice(0, 6));
}

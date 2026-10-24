// localStorage for per-viewer conveniences only (place, recents, last-seen cards).
// Every access is guarded: private windows and blocked storage must never break the app.

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full: the app works without it */
  }
}

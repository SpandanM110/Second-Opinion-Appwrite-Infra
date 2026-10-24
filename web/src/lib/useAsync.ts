'use client';

import { useEffect, useRef, useState } from 'react';

export type AsyncState<T> = { status: 'loading'; data?: T } | { status: 'ok'; data: T } | { status: 'error'; error: Error; data?: T };

/**
 * Runs `fn` whenever `deps` change; keeps the previous data visible while reloading.
 * `initial` is server-rendered data for the first `deps`: it is shown immediately, then quietly revalidated once
 * (no loading state), so a price you just saved never hides behind a cache.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], initial?: T): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>(initial !== undefined ? { status: 'ok', data: initial } : { status: 'loading' });
  const [tick, setTick] = useState(0);
  const skipFirst = useRef(initial !== undefined);
  useEffect(() => {
    let alive = true;
    const quiet = skipFirst.current;
    skipFirst.current = false;
    if (!quiet) setState((s) => ({ status: 'loading', data: s.data }));
    fn().then(
      (data) => alive && setState({ status: 'ok', data }),
      (error: Error) => alive && !quiet && setState((s) => ({ status: 'error', error, data: s.data })),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

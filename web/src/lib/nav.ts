'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

/** Read and replace query params on the current page without adding history entries or scrolling. */
export function useQueryState() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const replace = useCallback(
    (next: URLSearchParams | Record<string, string>) => {
      const qs = new URLSearchParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );
  return [params, replace] as const;
}

// How many in-app navigations this tab has made. history.length and document.referrer can't tell a
// shared link opened cold from a page reached from inside the app; this counter can.
let navigations = 0;

/** Mounted once in the app shell: counts route changes after the first paint. */
export function useNavigationCounter() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else navigations++;
  }, [pathname]);
}

/** Back button behaviour: real history when the visitor came from inside the app, otherwise the page's parent. */
export function useBack(fallback: string) {
  const router = useRouter();
  return useCallback(() => {
    if (navigations > 0) {
      navigations--;
      router.back();
    } else router.push(fallback);
  }, [router, fallback]);
}

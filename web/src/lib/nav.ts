'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

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

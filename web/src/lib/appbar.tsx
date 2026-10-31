'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * What the app bar shows for the current page. Root tabs leave it empty (logo + area chip);
 * sub-pages register a title and where "back" falls through to when there is no history.
 */
export interface AppBarState {
  title?: ReactNode;
  /** Fallback href for the back button when the visitor arrived here directly (shared link, reload). */
  back?: string;
  /** Right-hand control, e.g. the area chip on a card. */
  action?: ReactNode;
}

const Ctx = createContext<{ state: AppBarState; set: (s: AppBarState) => void } | null>(null);

export function AppBarProvider({ children }: { children: ReactNode }) {
  const [state, set] = useState<AppBarState>({});
  return <Ctx.Provider value={{ state, set }}>{children}</Ctx.Provider>;
}

/** Sub-pages call this once; the bar resets when they unmount. */
export function useAppBar(state: AppBarState, deps: unknown[]) {
  const ctx = useContext(Ctx);
  useEffect(() => {
    ctx?.set(state);
    return () => ctx?.set({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useAppBarState(): AppBarState {
  return useContext(Ctx)?.state ?? {};
}

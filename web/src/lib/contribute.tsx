'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AskSheet } from '../components/AskSheet';
import { LogSheet } from '../components/LogSheet';
import { useAuth } from './auth';

// One place that opens the "share a price" and "ask locals" sheets from anywhere (card, feed, floating button),
// asking the visitor to sign in first and then carrying straight on.

interface ContributeApi {
  openLog: (itemId?: string) => Promise<void>;
  openAsk: (itemId?: string) => Promise<void>;
}
const Ctx = createContext<ContributeApi | null>(null);

export function ContributeProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [log, setLog] = useState<{ open: boolean; itemId?: string }>({ open: false });
  const [ask, setAsk] = useState<{ open: boolean; itemId?: string }>({ open: false });

  const openLog = useCallback(
    async (itemId?: string) => {
      if (await auth.require('paid')) setLog({ open: true, itemId });
    },
    [auth],
  );
  const openAsk = useCallback(
    async (itemId?: string) => {
      if (await auth.require('ask')) setAsk({ open: true, itemId });
    },
    [auth],
  );
  const api = useMemo(() => ({ openLog, openAsk }), [openLog, openAsk]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <LogSheet open={log.open} itemId={log.itemId} onClose={() => setLog((s) => ({ ...s, open: false }))} />
      <AskSheet open={ask.open} itemId={ask.itemId} onClose={() => setAsk((s) => ({ ...s, open: false }))} />
    </Ctx.Provider>
  );
}

export function useContribute() {
  const v = useContext(Ctx);
  if (!v) throw new Error('ContributeProvider missing');
  return v;
}

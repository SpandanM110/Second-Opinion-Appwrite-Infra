'use client';

import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { FLAG_REASON_LABEL, FLAG_REASONS, LIMITS } from '../core/rules.js';
import { callWorker } from '../lib/api';
import { friendlyAuthError } from '../lib/authErrors';
import { Price } from './Price';
import { Sheet } from './Sheet';

export interface FlagResult { flag_count: number; hidden: boolean }

/** "This doesn't look right": pick why. Three flags from different people hide a price from every range. */
export function FlagSheet({ logId, price, itemName, onClose, onDone }: { logId: string; price: number; itemName?: string; onClose: () => void; onDone: (r: FlagResult) => void }) {
  const [reason, setReason] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await callWorker<FlagResult>({ action: 'flag', log_id: logId, reason });
      onDone(r);
      onClose();
    } catch (e) {
      setError(friendlyAuthError(e));
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title="Flag this price">
      <div className="space-y-4">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[15px]">
          <Price value={price} size="lg" />
          <span className="text-muted">{itemName}</span>
        </p>
        <p className="text-[14px] text-muted">What’s wrong with it? Flags don’t punish honest mistakes: the person can see why and share the price again. Once {LIMITS.flagsToHide} different people flag a price, it stops counting.</p>
        <fieldset>
          <legend className="sr-only">Why are you flagging this price?</legend>
          <div className="space-y-2" role="radiogroup">
            {FLAG_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className={`tap flex w-full items-center gap-3 rounded-xl border px-3 text-left text-[15px] ${reason === r ? 'border-accent bg-accent-soft font-semibold text-accent-ink' : 'border-line hover:bg-canvas'}`}
              >
                <span className={`size-4 shrink-0 rounded-full border-2 ${reason === r ? 'border-accent bg-accent' : 'border-line'}`} aria-hidden />
                {FLAG_REASON_LABEL[r as keyof typeof FLAG_REASON_LABEL]}
              </button>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn">
            {error}
          </p>
        )}
        <button type="button" className="btn-primary w-full" disabled={!reason || busy} onClick={submit}>
          {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Flag size={18} aria-hidden />}
          Flag this price
        </button>
      </div>
    </Sheet>
  );
}

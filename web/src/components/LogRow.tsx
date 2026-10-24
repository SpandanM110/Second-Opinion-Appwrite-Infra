'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EyeOff, Flag, Receipt, ThumbsUp } from 'lucide-react';
import { UNIT_LABEL } from '../core/card.js';
import { callWorker } from '../lib/api';
import { useAuth } from '../lib/auth';
import { friendlyAuthError } from '../lib/authErrors';
import { announceChange } from '../lib/events';
import { timeAgo } from '../lib/format';
import { useRefData } from '../lib/ref';
import { useToast } from '../lib/toast';
import type { PriceLog, UserRow } from '../lib/types';
import { FlagSheet, type FlagResult } from './FlagSheet';
import { Price } from './Price';

const TYPE_STYLE = {
  paid: 'bg-high-soft text-high',
  quoted: 'bg-warn-soft text-warn',
  listed: 'bg-scope-city-soft text-scope-city',
} as const;

/** One price, with one-tap confirm and flag. Hidden prices stay visible, greyed, with an "under review" tag and the reasons. */
export function LogRow({ log, author, showItem = false, hideLocality = false }: { log: PriceLog; author?: UserRow; showItem?: boolean; hideLocality?: boolean }) {
  const ref = useRefData();
  const auth = useAuth();
  const toast = useToast();
  const item = ref.item(log.item_id);
  const locality = ref.locality(log.locality_id);

  const [count, setCount] = useState(log.confirm_count);
  const [confirmed, setConfirmed] = useState(false);
  const [flags, setFlags] = useState(log.flag_count);
  const [hidden, setHidden] = useState(log.hidden);
  const [flagOpen, setFlagOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const own = auth.user?.$id === log.user_id;
  const canAct = !own && !hidden;

  const confirm = async () => {
    if (!(await auth.require('confirm'))) return;
    setBusy(true);
    try {
      const r = await callWorker<{ confirm_count: number }>({ action: 'confirm', log_id: log.$id });
      setCount(r.confirm_count);
      setConfirmed(true);
      toast('Thanks, you confirmed this price.');
      setTimeout(announceChange, 7000);
    } catch (e) {
      const msg = friendlyAuthError(e);
      if (/already/i.test(msg)) setConfirmed(true);
      toast(msg, /already/i.test(msg) ? 'info' : 'error');
    } finally {
      setBusy(false);
    }
  };

  const flagged = (r: FlagResult) => {
    setFlags(r.flag_count);
    setHidden(r.hidden);
    toast(r.hidden ? 'Flagged. That price is now hidden from the range.' : `Flagged. ${r.flag_count} of 3 flags needed to hide it.`);
    setTimeout(announceChange, 7000);
  };

  return (
    <li className={`flex items-start gap-3 py-3 ${hidden ? 'opacity-60' : ''}`}>
      <div className="min-w-[68px] shrink-0 pt-0.5">
        <Price value={log.price} size="md" className={hidden ? 'line-through' : ''} />
        {showItem && item && <span className="block text-[12px] text-faint">{UNIT_LABEL[item.unit]}</span>}
      </div>
      <div className="min-w-0 flex-1">
        {showItem && item && (
          <Link href={`/item/${item.$id}`} className="block truncate text-[15px] font-medium hover:underline">
            {item.name}
          </Link>
        )}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          <span className={`rounded-full px-2 py-px text-[12px] font-semibold ${TYPE_STYLE[log.price_type]}`}>{log.price_type}</span>
          {!hideLocality && (
            <>
              <span className="truncate">{locality?.name ?? `somewhere in ${ref.city(log.city_id)?.name ?? 'the city'}`}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <time dateTime={log.created_at}>{timeAgo(log.created_at)}</time>
        </p>
        {log.note && <p className="mt-1 text-[14px] text-ink/90">“{log.note}”</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-faint">
          {author && (
            <Link href={`/u/${author.$id}`} className="font-medium text-muted hover:underline">
              {author.display_name}
            </Link>
          )}
          {count > 0 && (
            <span className="inline-flex items-center gap-1">
              <ThumbsUp size={13} aria-hidden /> {count} paid about this too
            </span>
          )}
          {log.proof_file_id && (
            <span className="inline-flex items-center gap-1">
              <Receipt size={13} aria-hidden /> receipt
            </span>
          )}
          {hidden && (
            <span className="inline-flex items-center gap-1 font-semibold text-warn">
              <EyeOff size={13} aria-hidden /> under review{log.flag_reasons ? `: ${log.flag_reasons}` : ''} ({flags} {flags === 1 ? 'flag' : 'flags'})
            </span>
          )}
        </p>
        {hidden && own && <p className="mt-1 text-[13px] text-muted">Made a mistake? Share the price again, correctly.</p>}
        {canAct && (
          <div className="-ml-2 mt-0.5 flex flex-wrap items-center">
            <button
              type="button"
              onClick={confirm}
              disabled={busy || confirmed}
              aria-pressed={confirmed}
              className={`tap inline-flex items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold ${confirmed ? 'text-high' : 'text-accent-ink hover:bg-accent-soft'} disabled:cursor-default`}
            >
              <ThumbsUp size={15} aria-hidden /> {confirmed ? 'You paid about this too' : 'I paid about this too'}
            </button>
            <button type="button" onClick={() => setFlagOpen(true)} className="tap inline-flex items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-muted hover:bg-canvas">
              <Flag size={15} aria-hidden /> Flag
            </button>
          </div>
        )}
      </div>
      {flagOpen && <FlagSheet logId={log.$id} price={log.price} itemName={item?.name} onClose={() => setFlagOpen(false)} onDone={flagged} />}
    </li>
  );
}

/** The three price types, explained once in plain words wherever a list mixes them. */
export function PriceTypeHelp() {
  return (
    <p className="text-[12px] leading-relaxed text-faint">
      <b className="font-semibold text-high">paid</b> = what they handed over · <b className="font-semibold text-warn">quoted</b> = what they were asked first ·{' '}
      <b className="font-semibold text-scope-city">listed</b> = on a board or menu
    </p>
  );
}

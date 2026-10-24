'use client';

import Link from 'next/link';
import { EyeOff, Receipt, ThumbsUp } from 'lucide-react';
import { UNIT_LABEL } from '../core/card.js';
import { timeAgo } from '../lib/format';
import { useRefData } from '../lib/ref';
import type { PriceLog, UserRow } from '../lib/types';
import { Price } from './Price';

const TYPE_STYLE = {
  paid: 'bg-high-soft text-high',
  quoted: 'bg-warn-soft text-warn',
  listed: 'bg-scope-city-soft text-scope-city',
} as const;

/** One price log. Hidden logs stay visible, greyed, with an "under review" tag. */
export function LogRow({ log, author, showItem = false, hideLocality = false }: { log: PriceLog; author?: UserRow; showItem?: boolean; hideLocality?: boolean }) {
  const ref = useRefData();
  const item = ref.item(log.item_id);
  const locality = ref.locality(log.locality_id);
  return (
    <li className={`flex items-start gap-3 py-3 ${log.hidden ? 'opacity-55' : ''}`}>
      <div className="min-w-[68px] shrink-0 pt-0.5">
        <Price value={log.price} size="md" className={log.hidden ? 'line-through' : ''} />
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
              <span className="truncate">{locality?.name ?? `${ref.city(log.city_id)?.name ?? ''}, area not set`}</span>
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
          {log.confirm_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <ThumbsUp size={13} aria-hidden /> {log.confirm_count} paid about this too
            </span>
          )}
          {log.proof_file_id && (
            <span className="inline-flex items-center gap-1">
              <Receipt size={13} aria-hidden /> receipt
            </span>
          )}
          {log.hidden && (
            <span className="inline-flex items-center gap-1 font-semibold text-warn">
              <EyeOff size={13} aria-hidden /> under review ({log.flag_count} flags)
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

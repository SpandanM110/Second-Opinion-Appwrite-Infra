'use client';

import Link from 'next/link';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { timeAgo, verdict } from '../lib/format';
import { useRefData } from '../lib/ref';
import type { Card, QuoteCheck, UserRow } from '../lib/types';
import { band, Price } from './Price';

const TONE = { warn: 'bg-warn-soft text-warn', medium: 'bg-medium-soft text-medium', high: 'bg-high-soft text-high' } as const;

export function parseCard(json: string | null): Card | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Card;
  } catch {
    return null;
  }
}

/** A question in the feed ("is ₹X fair?"): the quote, where it lands against the attached range, and the reply count. */
export function QuoteCheckItem({ qc, asker }: { qc: QuoteCheck; asker?: UserRow }) {
  const ref = useRefData();
  const item = ref.item(qc.item_id);
  const locality = ref.locality(qc.locality_id);
  const card = parseCard(qc.attached_card);
  const v = card?.status === 'ok' ? verdict(qc.quoted_price, card.range) : null;

  return (
    <li>
      <Link href={`/q/${qc.$id}`} className="panel block p-4 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-faint">
              {item?.name} · {locality?.name ?? ref.city(qc.city_id)?.name}
            </p>
            <p className="mt-0.5 flex items-baseline gap-1.5 text-[15px]">
              Quoted <Price value={qc.quoted_price} size="md" />
            </p>
          </div>
          {v && <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${TONE[v.tone]}`}>{v.text}</span>}
        </div>
        {qc.body && <p className="mt-2 line-clamp-2 text-[15px] leading-snug">{qc.body}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          {card?.status === 'ok' && (
            <span className="num">
              Fair price: <span className="font-semibold text-ink">{band(card.range.p25, card.range.p75)}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={14} aria-hidden /> {qc.reply_count} {qc.reply_count === 1 ? 'reply' : 'replies'}
          </span>
          {qc.helpful_reply_id && (
            <span className="inline-flex items-center gap-1 text-high">
              <CheckCircle2 size={14} aria-hidden /> answered
            </span>
          )}
          <span className="ml-auto text-faint">
            {asker?.display_name ? `${asker.display_name} · ` : ''}
            {timeAgo(qc.created_at)}
          </span>
        </div>
      </Link>
    </li>
  );
}

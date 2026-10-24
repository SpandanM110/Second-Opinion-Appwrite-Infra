'use client';

import { useId, useState } from 'react';
import { Scale } from 'lucide-react';
import { rupees, verdict } from '../lib/format';
import { useRefData } from '../lib/ref';
import type { CardOk } from '../lib/types';

const NEGOTIABLE = new Set(['auto-cab', 'home-services']);
const TONE = { warn: 'bg-warn-soft text-warn', medium: 'bg-medium-soft text-medium', high: 'bg-high-soft text-high' } as const;

/**
 * Turns the range into a decision. Negotiable things (rides, home services) get a bargaining ladder;
 * fixed-price things (food, haircuts) get "what's normal". Either way, "got a quote? check it" answers the real question.
 */
export function UseIt({ card }: { card: CardOk }) {
  const ref = useRefData();
  const inputId = useId();
  const [quote, setQuote] = useState('');
  const { median, p25, p90 } = card.range;
  const item = ref.item(card.item.id);
  const negotiable = item ? NEGOTIABLE.has(item.category_id) : false;
  const quoted = Number(quote);
  const v = quote && Number.isFinite(quoted) && quoted > 0 ? verdict(quoted, card.range) : null;

  if (card.confidence.level === 'low') return null;

  return (
    <section className="space-y-3 rounded-xl bg-accent-soft/60 p-3.5" aria-labelledby={`${inputId}-h`}>
      <h2 id={`${inputId}-h`} className="flex items-center gap-2 text-[15px] font-semibold text-accent-ink">
        <Scale size={17} aria-hidden /> Use it
      </h2>

      {negotiable ? (
        <ol className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Start near', p25],
            ['Settle around', median],
            ['Walk away above', p90],
          ].map(([label, value]) => (
            <li key={label as string} className="rounded-lg bg-surface px-1.5 py-2">
              <span className="block text-[12px] leading-tight text-muted">{label}</span>
              <span className="num mt-0.5 block text-[17px] font-semibold">₹{rupees(value as number)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[14px] text-muted">
          Anything from <span className="num font-semibold text-ink">₹{rupees(p25)}</span> to <span className="num font-semibold text-ink">₹{rupees(card.range.p75)}</span> is normal here. Above{' '}
          <span className="num font-semibold text-ink">₹{rupees(p90)}</span> is high.
        </p>
      )}

      <div>
        <label htmlFor={inputId} className="mb-1 block text-[13px] font-semibold text-muted">
          Got a quote? Check it
        </label>
        <span className="relative block w-40 shrink-0">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-faint" aria-hidden>
            ₹
          </span>
          <input
            id={inputId}
            inputMode="numeric"
            autoComplete="off"
            value={quote}
            onChange={(e) => setQuote(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Quoted price"
            className="num tap w-full rounded-xl border border-line bg-surface pl-7 pr-2 text-[16px] outline-none placeholder:text-[13px] placeholder:text-faint focus:border-accent"
          />
        </span>
        <p className="mt-2 min-h-[34px] text-[14px]" role="status" aria-live="polite">
          {v && (
            <span className={`inline-block rounded-lg px-2.5 py-1.5 font-medium ${TONE[v.tone]}`}>
              ₹{rupees(quoted)} is {v.text}
            </span>
          )}
        </p>
      </div>
    </section>
  );
}

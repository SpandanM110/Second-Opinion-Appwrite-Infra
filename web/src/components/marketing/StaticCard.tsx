import Link from 'next/link';
import { AlertTriangle, ArrowRight, ChevronRight } from 'lucide-react';
import type { CardOk } from '../../lib/types';
import { ConfidenceBadge } from '../ConfidenceBadge';
import { band, Price } from '../Price';
import { RangeBar } from '../RangeBar';
import { ScopeChip } from '../ScopeChip';

function Pin({ n }: { n: number }) {
  return (
    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white" role="img" aria-label={`Note ${n}`}>
      {n}
    </span>
  );
}

export const CARD_NOTES = [
  'The typical price: what the middle person paid.',
  'The range most people paid. Half of everyone is inside the dark band.',
  'How much to trust it, and why: how many people, how recent.',
  'What sellers tend to ask first. Know it before you hear it.',
];

/** The real fair-range card, read-only, with numbered notes. The landing page shows this instead of describing it. */
export function StaticCard({ card, href }: { card: CardOk; href: string }) {
  return (
    <div>
      <div className="panel space-y-4 p-4 shadow-lg sm:p-6">
        <div>
          <p className="text-[18px] font-semibold leading-tight sm:text-[20px]">
            {card.item.name}
            <span className="font-normal text-faint">, {card.item.unitLabel}</span>
          </p>
          <div className="mt-2">
            <ScopeChip type={card.scope.type} label={card.scope.label} fallback={card.scope.fallback} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Price value={card.range.median} size="hero" />
          <Pin n={1} />
        </div>
        <p className="num flex flex-wrap items-center gap-2 text-[16px] text-muted">
          <span>
            most people paid <span className="font-semibold text-ink">{band(card.range.p25, card.range.p75)}</span>
          </span>
          <Pin n={2} />
        </p>
        <RangeBar {...card.range} />
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <ConfidenceBadge level={card.confidence.level} reason={card.confidence.reason} />
          </div>
          <span className="mt-2.5"><Pin n={3} /></span>
        </div>
        {card.overcharge && (
          <p className="flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn">
            <AlertTriangle size={17} className="mt-px shrink-0" aria-hidden />
            <span className="flex-1">
              <span className="font-semibold">First quotes here average {card.overcharge.index.toFixed(1)}x</span> the fair price.
            </span>
            <Pin n={4} />
          </p>
        )}
      </div>
      <Link href={href} className="tap mt-2 inline-flex items-center gap-1.5 text-[15px] font-semibold text-accent-ink hover:underline">
        Open this card and explore <ArrowRight size={16} aria-hidden />
      </Link>
    </div>
  );
}

export function CardNotes({ withQuotes = true }: { withQuotes?: boolean }) {
  return (
    <ol className="space-y-3" aria-label="How to read the card">
      {CARD_NOTES.slice(0, withQuotes ? 4 : 3).map((t, i) => (
        <li key={t} className="flex items-start gap-3 text-[15px] text-muted">
          <Pin n={i + 1} />
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );
}

/** Phones: the real answer in one strip, so a price is visible on the very first screen. */
export function MiniProof({ card, href }: { card: CardOk; href: string }) {
  return (
    <Link href={href} className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm lg:hidden">
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          <span className="truncate">
            {card.item.name} · {card.scope.label}
          </span>
          <span className="shrink-0 rounded-full bg-low-soft px-1.5 text-[10px] font-semibold text-low">demo</span>
        </span>
        <span className="num mt-0.5 block text-[14px] text-muted">
          most paid <b className="text-ink">{band(card.range.p25, card.range.p75)}</b> · {card.confidence.level} confidence
        </span>
        {card.overcharge && (
          <span className="num mt-0.5 block text-[13px] font-medium text-warn">first quotes here average {card.overcharge.index.toFixed(1)}x that</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <Price value={card.range.median} size="lg" />
        <ChevronRight size={18} className="text-faint" aria-hidden />
      </span>
    </Link>
  );
}

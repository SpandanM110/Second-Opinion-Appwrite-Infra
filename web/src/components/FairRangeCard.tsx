'use client';

import { AlertTriangle, ArrowLeftRight, Clock, CloudOff, MessageCircleQuestion, PenLine } from 'lucide-react';
import type { Card, CardOk } from '../lib/types';
import { timeAgo } from '../lib/format';
import { band, Price } from './Price';
import { ConfidenceBadge } from './ConfidenceBadge';
import { ScopeChip } from './ScopeChip';
import { RangeBar } from './RangeBar';

interface Actions {
  onPaid: () => void;
  onAsk: () => void;
  onCompare: () => void;
}

/** Card anatomy, top to bottom, exactly as in the build plan's UI section. */
export function FairRangeCard({ card, staleSince, actions }: { card: Card; staleSince?: string; actions: Actions }) {
  return (
    <article className="panel overflow-hidden" aria-labelledby="card-title">
      <div className="space-y-4 p-4 sm:p-6">
        <header>
          <h1 id="card-title" className="text-[20px] font-semibold leading-tight sm:text-[22px]">
            {card.item.name}
            <span className="font-normal text-faint">, {card.item.unitLabel}</span>
          </h1>
        </header>

        {staleSince && (
          <p className="flex items-center gap-2 rounded-xl bg-low-soft px-3 py-2 text-[13px] text-low">
            <CloudOff size={15} aria-hidden /> Offline. Showing the card as of {timeAgo(staleSince)}.
          </p>
        )}

        {card.status === 'ok' ? <Body card={card} /> : <NoData message={card.message} onPaid={actions.onPaid} />}
      </div>

      {card.status === 'ok' && (
        <div className="grid grid-cols-3 border-t border-line">
          <ActionButton onClick={actions.onPaid} icon={<PenLine size={18} />} label="I paid" primary />
          <ActionButton onClick={actions.onAsk} icon={<MessageCircleQuestion size={18} />} label="Ask locals" />
          <ActionButton onClick={actions.onCompare} icon={<ArrowLeftRight size={18} />} label="Compare" />
        </div>
      )}
    </article>
  );
}

function Body({ card }: { card: CardOk }) {
  const { range, confidence, scope } = card;
  return (
    <>
      <ScopeChip type={scope.type} label={scope.label} fallback={scope.fallback} />

      <div>
        <Price value={range.median} size="hero" />
        <p className="num mt-1.5 text-[16px] text-muted">
          most people paid <span className="font-semibold text-ink">{band(range.p25, range.p75)}</span>
        </p>
        {confidence.roughGuide && <p className="mt-1 text-[14px] font-medium text-low">Treat this as a rough guide.</p>}
      </div>

      <RangeBar {...range} />

      <ConfidenceBadge level={confidence.level} reason={confidence.reason} />

      {card.overcharge && (
        <p className="flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn">
          <AlertTriangle size={17} className="mt-px shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">First quotes here average {card.overcharge.index.toFixed(1)}x</span> the fair rate. Expect to bargain.
          </span>
        </p>
      )}

      <p className="flex items-center gap-1.5 text-[12px] text-faint">
        <Clock size={13} aria-hidden /> Updated {timeAgo(card.computedAt)} · newest log {timeAgo(card.sample.newestLogAt)}
      </p>
    </>
  );
}

function NoData({ message, onPaid }: { message: string; onPaid: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center">
      <p className="text-[16px] font-medium">{message}</p>
      <p className="mt-1 text-[14px] text-muted">Your price becomes the first data point for everyone after you.</p>
      <button type="button" onClick={onPaid} className="btn-primary mt-4">
        <PenLine size={18} aria-hidden /> Log what you paid
      </button>
    </div>
  );
}

function ActionButton({ onClick, icon, label, primary = false }: { onClick: () => void; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap flex min-h-14 flex-col items-center justify-center gap-0.5 border-line text-[14px] font-semibold transition-colors not-last:border-r sm:flex-row sm:gap-2 ${
        primary ? 'bg-accent text-white hover:bg-accent-hover' : 'text-accent-ink hover:bg-accent-soft'
      }`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );
}

/** Compact card for Compare and Quote Check snapshots. */
export function MiniCard({ card, title, marker }: { card: Card; title?: string; marker?: { value: number; label: string } }) {
  if (card.status !== 'ok') {
    return (
      <div className="panel p-3 sm:p-4">
        {title && <p className="text-[13px] font-semibold text-muted">{title}</p>}
        <p className="mt-2 text-[14px] text-muted">{card.message}</p>
      </div>
    );
  }
  return (
    <div className="panel space-y-2.5 p-3 sm:p-4">
      {title && <p className="truncate text-[13px] font-semibold text-muted">{title}</p>}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Price value={card.range.median} size="lg" />
        <ConfidenceBadge level={card.confidence.level} reason={card.confidence.reason} compact />
      </div>
      <p className="num text-[14px] text-muted">
        most paid <span className="font-semibold text-ink">{band(card.range.p25, card.range.p75)}</span>
      </p>
      <RangeBar {...card.range} marker={marker} compact />
      {marker && (
        <p className="num text-[13px] font-semibold text-warn">
          {marker.label} ₹{marker.value.toLocaleString('en-IN')} vs median ₹{card.range.median.toLocaleString('en-IN')}
        </p>
      )}
      <p className="text-[12px] leading-snug text-faint">{card.sample.line}</p>
    </div>
  );
}

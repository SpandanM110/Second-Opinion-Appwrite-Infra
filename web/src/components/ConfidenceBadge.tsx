'use client';

import { useId, useState } from 'react';
import { ShieldCheck, ShieldHalf, ShieldQuestion, ChevronDown } from 'lucide-react';
import type { Confidence } from '../lib/types';

const STYLE: Record<Confidence, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
  high: { label: 'High confidence', cls: 'bg-high-soft text-high', Icon: ShieldCheck },
  medium: { label: 'Medium confidence', cls: 'bg-medium-soft text-medium', Icon: ShieldHalf },
  low: { label: 'Low confidence', cls: 'bg-low-soft text-low', Icon: ShieldQuestion },
};

const MEANING: Record<Confidence, string> = {
  high: 'High confidence: plenty of recent prices from at least 3 people, tightly grouped. Safe to negotiate from.',
  medium: 'Medium confidence: a solid ballpark, but fewer, older or more spread-out prices than High needs.',
  low: 'Low confidence: too few prices to be sure. Treat it as a rough guide, and add what you paid.',
};

export function ConfidenceDot({ level }: { level: Confidence }) {
  const color = level === 'high' ? 'bg-high' : level === 'medium' ? 'bg-medium' : 'bg-faint';
  return <span className={`inline-block size-2 shrink-0 rounded-full ${color}`} role="img" aria-label={`${STYLE[level].label} confidence`} />;
}

export function ConfidenceBadge({ level, reason, compact = false }: { level: Confidence; reason: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { label, cls, Icon } = STYLE[level];

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ${cls}`}>
        <Icon size={13} aria-hidden /> {label.replace(' confidence', '')}
        <span className="sr-only"> confidence</span>
      </span>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="tap -mx-1 flex w-full items-center gap-2 rounded-xl px-1 text-left"
      >
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold ${cls}`}>
          <Icon size={15} aria-hidden /> {label}
        </span>
        <span className="min-w-0 flex-1 text-[14px] text-muted">{reason}</span>
        <ChevronDown size={16} className={`shrink-0 text-faint transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <p id={id} className="mt-1 rounded-xl bg-canvas px-3 py-2 text-[13px] leading-relaxed text-muted">
          {MEANING[level]} Prices from trusted locals, with receipts, and confirmed by neighbours count for more; older prices fade over about a month.
        </p>
      )}
    </div>
  );
}

/** One line under a list that uses the dots, so the colours mean something. */
export function ConfidenceLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-faint">
      <span>The dot shows how much to trust each price:</span>
      <span className="inline-flex items-center gap-1.5"><ConfidenceDot level="high" /> high</span>
      <span className="inline-flex items-center gap-1.5"><ConfidenceDot level="medium" /> medium</span>
      <span className="inline-flex items-center gap-1.5"><ConfidenceDot level="low" /> low</span>
    </p>
  );
}

'use client';

import { useId, useState } from 'react';
import { ShieldCheck, ShieldHalf, ShieldQuestion, ChevronDown } from 'lucide-react';
import type { Confidence } from '../lib/types';

const STYLE: Record<Confidence, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
  high: { label: 'High', cls: 'bg-high-soft text-high', Icon: ShieldCheck },
  medium: { label: 'Medium', cls: 'bg-medium-soft text-medium', Icon: ShieldHalf },
  low: { label: 'Low', cls: 'bg-low-soft text-low', Icon: ShieldQuestion },
};

const MEANING: Record<Confidence, string> = {
  high: 'High: at least 15 weighted logs from 3+ people, a tight range, and a log in the last 30 days.',
  medium: 'Medium: enough logs to trust the ballpark, but the sample is smaller, wider or older than High needs.',
  low: 'Low: too few logs to be sure. Treat it as a rough guide, and add what you paid.',
};

export function ConfidenceDot({ level }: { level: Confidence }) {
  const color = level === 'high' ? 'bg-high' : level === 'medium' ? 'bg-medium' : 'bg-faint';
  return <span className={`inline-block size-2 shrink-0 rounded-full ${color}`} aria-label={`${STYLE[level].label} confidence`} />;
}

export function ConfidenceBadge({ level, reason, compact = false }: { level: Confidence; reason: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { label, cls, Icon } = STYLE[level];

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ${cls}`}>
        <Icon size={13} aria-hidden /> {label}
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
          {MEANING[level]} Logs from trusted locals, with receipts, and confirmed by neighbours count for more; old logs fade over about a month.
        </p>
      )}
    </div>
  );
}

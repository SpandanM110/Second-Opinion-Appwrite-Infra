'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleHelp, X } from 'lucide-react';

export const GUIDE_COOKIE = 'so_guide';

const PINS = [
  ['The big number', 'is the typical price: what the middle person paid.'],
  ['The dark band', 'is where half of everyone paid.'],
  ['The badge', 'says how much to trust it. Tap it to see why.'],
] as const;

function remember() {
  document.cookie = `${GUIDE_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
}

/**
 * First card a visitor sees: three pinned lines, shown under the price so the answer comes first.
 * Goes away on "Got it" or once the visitor has scrolled past it; afterwards a small link brings it back.
 */
export function CardGuide({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [auto, setAuto] = useState(defaultOpen); // true until the visitor asks for it: scrolling past then counts as read
  const box = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open || !auto || !box.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting && e.boundingClientRect.bottom < 0) {
        remember();
        setOpen(false);
      }
    });
    io.observe(box.current);
    return () => io.disconnect();
  }, [open, auto]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setAuto(false);
          setOpen(true);
        }}
        className="tap -ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 text-[14px] font-medium text-accent-ink hover:underline"
      >
        <CircleHelp size={16} aria-hidden /> How to read this card
      </button>
    );
  }

  return (
    <section ref={box} className="rounded-xl border border-accent/20 bg-accent-soft/70 px-3 py-2.5" aria-label="How to read this card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold text-accent-ink">How to read this card</h2>
        <button
          type="button"
          onClick={() => {
            remember();
            setOpen(false);
          }}
          className="tap -mr-2 inline-flex items-center justify-center rounded-lg text-accent-ink hover:bg-surface/60"
          aria-label="Got it, hide this"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <ol className="mt-1 space-y-1.5 text-[14px] leading-snug text-ink/80">
        {PINS.map(([b, rest], i) => (
          <li key={b} className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white" aria-hidden>
              {i + 1}
            </span>
            <span>
              <b className="text-ink">{b}</b> {rest}
            </span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => {
          remember();
          setOpen(false);
        }}
        className="btn-primary mt-2 h-9 px-3 text-[13px]"
      >
        Got it
      </button>
    </section>
  );
}

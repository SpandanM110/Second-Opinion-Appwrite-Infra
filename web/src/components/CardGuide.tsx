'use client';

import { useState } from 'react';
import { CircleHelp, X } from 'lucide-react';

export const GUIDE_COOKIE = 'so_guide';

/** First card a visitor sees: three lines on how to read it. Afterwards a small "How to read this" link. */
export function CardGuide({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="tap -ml-1 mb-1 inline-flex items-center gap-1.5 rounded-lg px-1 text-[14px] font-medium text-accent-ink hover:underline">
        <CircleHelp size={16} aria-hidden /> How to read this card
      </button>
    );
  }

  return (
    <section className="mb-3 rounded-2xl border border-accent/20 bg-accent-soft p-4" aria-label="How to read this card">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-accent-ink">How to read this card</h2>
        <button
          type="button"
          onClick={() => {
            document.cookie = `${GUIDE_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
            setOpen(false);
          }}
          className="tap -mr-2 -mt-2 inline-flex items-center justify-center rounded-lg text-accent-ink hover:bg-white/60"
          aria-label="Got it, hide this"
        >
          <X size={18} aria-hidden />
        </button>
      </div>
      <ol className="mt-1 space-y-2 text-[14px] leading-relaxed text-ink/80">
        <li>
          <b className="text-ink">The big number</b> is the typical price: what the middle person paid.
        </li>
        <li>
          <b className="text-ink">The bar</b> shows the range. The dark band is where half of everyone paid.
        </li>
        <li>
          <b className="text-ink">The badge</b> says how much to trust it. Tap it to see why.
        </li>
      </ol>
      <button
        type="button"
        onClick={() => {
          document.cookie = `${GUIDE_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
          setOpen(false);
        }}
        className="btn-primary mt-3 h-10 px-4 text-[14px]"
      >
        Got it
      </button>
    </section>
  );
}

'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Bottom sheet on phones, centred dialog on larger screens. Native <dialog> gives focus trapping and Esc. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-2 sm:px-5">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="tap -mr-2 inline-flex items-center justify-center rounded-full text-muted hover:bg-canvas" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">{children}</div>
      </div>
    </dialog>
  );
}

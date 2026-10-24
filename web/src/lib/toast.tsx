'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react';

type Tone = 'ok' | 'info' | 'error';
interface ToastApi { toast: (message: string, tone?: Tone) => void }
const Ctx = createContext<ToastApi | null>(null);

const STYLE: Record<Tone, { cls: string; Icon: typeof Info }> = {
  ok: { cls: 'bg-ink text-white', Icon: CheckCircle2 },
  info: { cls: 'bg-ink text-white', Icon: Info },
  error: { cls: 'bg-warn text-white', Icon: TriangleAlert },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<{ id: number; message: string; tone: Tone } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const toast = useCallback((message: string, tone: Tone = 'ok') => {
    window.clearTimeout(timer.current);
    setItem({ id: Date.now(), message, tone });
    timer.current = window.setTimeout(() => setItem(null), 4500);
  }, []);
  const api = useMemo(() => ({ toast }), [toast]);
  const S = item ? STYLE[item.tone] : null;

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-[60] flex justify-center px-4 md:bottom-6" role="status" aria-live="polite">
        {item && S && (
          <p key={item.id} className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-2xl px-4 py-3 text-[14px] font-medium shadow-xl ${S.cls}`}>
            <S.Icon size={18} className="mt-px shrink-0" aria-hidden />
            {item.message}
          </p>
        )}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('ToastProvider missing');
  return v.toast;
}

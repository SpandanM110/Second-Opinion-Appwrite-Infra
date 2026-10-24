'use client';

import type { ReactNode } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

export function ErrorState({ message = 'Couldn’t load this right now.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-4 py-8 text-center" role="alert">
      <WifiOff size={22} className="text-faint" aria-hidden />
      <p className="text-[15px] text-muted">{message} Check your connection and try again.</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary">
          <RefreshCw size={16} aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      {children && <div className="mt-1 text-[14px] text-muted">{children}</div>}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4 py-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3">
          <div className="skeleton h-5 w-14" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="panel space-y-4 p-4 sm:p-6" aria-busy="true" aria-label="Loading fair range">
      <div className="skeleton h-6 w-2/3" />
      <div className="skeleton h-6 w-40 rounded-full" />
      <div className="skeleton h-11 w-32" />
      <div className="skeleton h-4 w-48" />
      <div className="skeleton h-7 w-full" />
      <div className="skeleton h-8 w-full" />
    </div>
  );
}

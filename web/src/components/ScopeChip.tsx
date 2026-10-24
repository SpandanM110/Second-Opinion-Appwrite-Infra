import { MapPin, Building2, Map } from 'lucide-react';
import type { ScopeType } from '../lib/types';

/** How local the number is. Changes colour and wording on fallback so a city number never looks hyperlocal. */
export function ScopeChip({ type, label, fallback }: { type: ScopeType; label: string; fallback: boolean }) {
  const cls =
    type === 'locality'
      ? 'bg-accent-soft text-accent-ink'
      : type === 'city'
        ? 'bg-scope-city-soft text-scope-city'
        : 'bg-low-soft text-low';
  const Icon = type === 'locality' ? MapPin : type === 'city' ? Building2 : Map;
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium ${cls}`}>
      <Icon size={14} className="shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
      {fallback && <span className="sr-only">(fallback, not enough local data)</span>}
    </span>
  );
}

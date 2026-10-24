'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, LocateFixed, Loader2, MapPin, Search } from 'lucide-react';
import { usePlace, type LocateStatus } from '../lib/place';
import { useRefData } from '../lib/ref';
import { Sheet } from './Sheet';

const KIND_LABEL = { residential: 'Residential', transit_hub: 'Station / bus stand', market: 'Market', tourist: 'Tourist area' } as const;

const STATUS_MSG: Partial<Record<LocateStatus, string>> = {
  denied: 'Location is blocked for this site. Pick your area below; it works just as well.',
  unavailable: 'Couldn’t get your location. Pick your area below.',
  outside: 'You seem to be outside Bhopal, Indore and Mumbai. Pick a city to explore.',
};

/** The locality chip. Reads "Choose your area" until there is one; always one tap from the picker. */
export function PlaceChip({ className = '' }: { className?: string }) {
  const { city, locality } = usePlace();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`tap inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[14px] font-medium hover:bg-canvas ${className}`}
        aria-label={`Area: ${locality ? `${locality.name}, ` : ''}${city?.name ?? 'not set'}. Change area`}
      >
        <MapPin size={16} className="shrink-0 text-accent-ink" aria-hidden />
        <span className="truncate">
          {locality ? (
            <>
              {locality.name}
              <span className="text-faint">, {city?.name}</span>
            </>
          ) : (
            <>
              <span className="text-accent-ink">Choose your area</span>
              <span className="text-faint"> · {city?.name}</span>
            </>
          )}
        </span>
        <ChevronDown size={16} className="shrink-0 text-faint" aria-hidden />
      </button>
      <PlacePicker open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function PlacePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRefData();
  const place = usePlace();
  const [cityId, setCityId] = useState(place.city?.$id ?? 'bhopal');
  const [q, setQ] = useState('');
  const asked = useRef(false);

  useEffect(() => {
    if (!open) return;
    setCityId(place.city?.$id ?? 'bhopal');
    setQ('');
    asked.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // A successful GPS fix answers the question: close and show the new chip.
  useEffect(() => {
    if (open && asked.current && place.status === 'ok') onClose();
  }, [open, place.status, onClose]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ref.localitiesIn(cityId).filter((l) => !needle || l.name.toLowerCase().includes(needle));
  }, [ref, cityId, q]);

  const choose = (localityId: string | null) => {
    place.setPlace(cityId, localityId);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Where are you checking?">
      <button type="button" onClick={() => {
          asked.current = true;
          place.locate();
        }} className="btn-secondary w-full" disabled={place.status === 'locating'}>
        {place.status === 'locating' ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <LocateFixed size={18} aria-hidden />}
        {place.status === 'locating' ? 'Finding you…' : 'Use my location'}
      </button>
      {STATUS_MSG[place.status] && (
        <p className="mt-2 text-[13px] text-muted" role="status">
          {STATUS_MSG[place.status]}
        </p>
      )}

      <fieldset className="mt-4">
        <legend className="mb-2 text-[13px] font-semibold text-muted">City</legend>
        <div className="grid grid-cols-3 gap-2">
          {ref.cities.map((c) => (
            <button
              key={c.$id}
              type="button"
              aria-pressed={cityId === c.$id}
              onClick={() => setCityId(c.$id)}
              className={`tap rounded-xl border px-2 text-[14px] font-semibold ${cityId === c.$id ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line hover:bg-canvas'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className="mb-2 block text-[13px] font-semibold text-muted">Area</span>
        <span className="relative block">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search areas"
            className="tap w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-[16px] outline-none focus:border-accent"
          />
        </span>
      </label>

      <ul className="mt-2 divide-y divide-line" role="list">
        <li>
          <button type="button" onClick={() => choose(null)} className="tap flex w-full items-center justify-between py-2 text-left">
            <span>
              <span className="block text-[15px] font-medium">Anywhere in {ref.city(cityId)?.name}</span>
              <span className="text-[13px] text-faint">City-wide prices</span>
            </span>
            {place.city?.$id === cityId && !place.locality && <Check size={18} className="text-accent-ink" aria-label="Selected" />}
          </button>
        </li>
        {list.map((l) => (
          <li key={l.$id}>
            <button type="button" onClick={() => choose(l.$id)} className="tap flex w-full items-center justify-between py-2 text-left">
              <span>
                <span className="block text-[15px] font-medium">{l.name}</span>
                <span className="text-[13px] text-faint">{KIND_LABEL[l.kind]}</span>
              </span>
              {place.locality?.$id === l.$id && <Check size={18} className="text-accent-ink" aria-label="Selected" />}
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="py-4 text-center text-[14px] text-muted">No area called “{q}” yet. Try a nearby one, or pick “Anywhere”.</li>}
      </ul>
    </Sheet>
  );
}

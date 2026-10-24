'use client';

import { Loader2, LocateFixed } from 'lucide-react';
import { usePlace } from '../../lib/place';
import { useRefData } from '../../lib/ref';

/** The first-run question: where are you? One tap sets the city for everything that follows. */
export function CityChips() {
  const ref = useRefData();
  const place = usePlace();
  const current = place.source === 'default' ? null : place.city?.$id;

  return (
    <div>
      <p id="city-q" className="mb-2 text-[13px] font-semibold text-muted">
        Which city are you in?
      </p>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="city-q">
        {ref.cities.map((c) => (
          <button
            key={c.$id}
            type="button"
            aria-pressed={current === c.$id}
            onClick={() => place.setPlace(c.$id, null)}
            className={`tap rounded-full border px-4 text-[15px] font-semibold transition-colors ${
              current === c.$id ? 'border-accent bg-accent text-white' : 'border-line bg-surface hover:bg-accent-soft'
            }`}
          >
            {c.name}
          </button>
        ))}
        <button
          type="button"
          onClick={place.locate}
          disabled={place.status === 'locating'}
          className="btn-ghost h-11 px-3 text-[14px]"
        >
          {place.status === 'locating' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <LocateFixed size={16} aria-hidden />}
          Use my location
        </button>
      </div>
      <p className="mt-2 min-h-5 text-[13px] text-muted" role="status">
        {place.status === 'denied' && 'Location is off. Pick your city above; it works just as well.'}
        {place.status === 'outside' && 'You seem to be outside our cities. Pick one to explore.'}
        {place.status === 'unavailable' && 'Couldn’t get your location. Pick your city above.'}
        {place.status === 'ok' && place.city && `Found you in ${place.city.name}.`}
      </p>
    </div>
  );
}

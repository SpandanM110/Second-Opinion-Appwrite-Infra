'use client';

import { usePlace } from '../../lib/place';
import { useRefData } from '../../lib/ref';

/** The first-run question: where are you? One tap sets the city for everything that follows. GPS lives in the area picker inside the app. */
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
      </div>
    </div>
  );
}

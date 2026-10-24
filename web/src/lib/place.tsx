'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { resolveLocation } from '../core/geo.js';
import { useRefData } from './ref';
import { load, save } from './storage';
import type { City, Locality } from './types';

// Where the user is checking prices for. GPS fills it in; the manual picker always wins and is
// never more than one tap away (plan: "the core flow never blocks on permissions").
// Kept in a cookie so the server can render the card for the right area on first paint.

export type LocateStatus = 'idle' | 'locating' | 'denied' | 'unavailable' | 'outside' | 'ok';
export interface StoredPlace { cityId: string; localityId: string | null; source: 'gps' | 'manual' | 'default' }
interface PlaceApi {
  city: City | undefined;
  locality: Locality | undefined;
  source: StoredPlace['source'];
  status: LocateStatus;
  setPlace: (cityId: string, localityId: string | null) => void;
  locate: () => void;
  /** Last GPS fix from the last 30 minutes, if any. Stored on prices you share so areas can be redrawn later. */
  coords: { lat: number; lng: number } | null;
}

const COOKIE = 'so_place';
const COORDS_KEY = 'so.coords.v1';
const SOURCE_KEY = 'so.place.source';
export const DEFAULT_PLACE: StoredPlace = { cityId: 'bhopal', localityId: null, source: 'default' };
const Ctx = createContext<PlaceApi | null>(null);

function writeCookie(p: StoredPlace) {
  document.cookie = `${COOKIE}=${encodeURIComponent(`${p.cityId}|${p.localityId ?? ''}`)}; path=/; max-age=31536000; samesite=lax`;
  try {
    localStorage.setItem(SOURCE_KEY, p.source);
  } catch {
    /* optional */
  }
}

export function PlaceProvider({ initial, children }: { initial: StoredPlace; children: ReactNode }) {
  const ref = useRefData();
  const router = useRouter();
  const [place, setPlaceState] = useState<StoredPlace>(initial);
  const [status, setStatus] = useState<LocateStatus>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Whether the place came from GPS or a manual pick isn't in the cookie; restore it after hydration.
  useEffect(() => {
    const c = load<{ lat: number; lng: number; at: number } | null>(COORDS_KEY, null);
    if (c && Date.now() - c.at < 30 * 60_000) setCoords({ lat: c.lat, lng: c.lng });
    try {
      const source = localStorage.getItem(SOURCE_KEY) as StoredPlace['source'] | null;
      if (source && source !== place.source) setPlaceState((p) => ({ ...p, source }));
    } catch {
      /* optional */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = useCallback(
    (p: StoredPlace) => {
      setPlaceState(p);
      writeCookie(p);
      router.refresh(); // server components re-render for the new place
    },
    [router],
  );

  const setPlace = useCallback((cityId: string, localityId: string | null) => commit({ cityId, localityId, source: 'manual' }), [commit]);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) return setStatus('unavailable');
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { city, locality } = resolveLocation(pos.coords.latitude, pos.coords.longitude, ref.cities, ref.localities) as {
          city: City | null;
          locality: Locality | null;
        };
        if (!city) return setStatus('outside');
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        save(COORDS_KEY, { lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now() });
        commit({ cityId: city.$id, localityId: locality?.$id ?? null, source: 'gps' });
        setStatus('ok');
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, [ref.cities, ref.localities, commit]);

  // Re-detect silently only if the user already granted permission and hasn't picked by hand.
  useEffect(() => {
    if (!ref.ready || place.source === 'manual') return;
    navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then(
      (p) => p.state === 'granted' && locate(),
      () => {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref.ready]);

  const api = useMemo<PlaceApi>(
    () => ({
      city: ref.city(place.cityId) ?? ref.city('bhopal'),
      locality: ref.locality(place.localityId),
      source: place.source,
      status,
      setPlace,
      locate,
      coords,
    }),
    [ref, place, status, setPlace, locate, coords],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePlace() {
  const v = useContext(Ctx);
  if (!v) throw new Error('PlaceProvider missing');
  return v;
}

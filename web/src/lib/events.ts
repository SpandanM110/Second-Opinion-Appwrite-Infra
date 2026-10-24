'use client';

import { useEffect } from 'react';

const EVENT = 'so:data-changed';

/** Something the user did changed the data on screen (a price, a confirmation, a flag). */
export const announceChange = () => window.dispatchEvent(new Event(EVENT));

export function useOnChange(callback: () => void) {
  useEffect(() => {
    window.addEventListener(EVENT, callback);
    return () => window.removeEventListener(EVENT, callback);
  }, [callback]);
}

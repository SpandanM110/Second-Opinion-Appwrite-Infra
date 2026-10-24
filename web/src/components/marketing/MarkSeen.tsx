'use client';

import { useEffect } from 'react';
import { markSeen } from '../../lib/seen';

/**
 * Marks the visitor as "has seen the landing page", but only when they leave it (client navigation unmounts
 * this, closing the tab fires pagehide). Marking earlier would turn router.refresh() on `/` (picking a city)
 * into a redirect to the app. Counts only if they engaged: a touch, a scroll, or a few seconds on the page.
 */
export function MarkSeen() {
  useEffect(() => {
    let engaged = false;
    const engage = () => {
      engaged = true;
    };
    const timer = window.setTimeout(engage, 4000);
    const onScroll = () => window.scrollY > 300 && engage();
    const leave = () => engaged && markSeen();

    window.addEventListener('pointerdown', engage, { once: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', leave);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', engage);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, []);
  return null;
}

'use client';

import type { ReactNode } from 'react';
import { Layout } from '../components/Layout';
import { PlaceProvider, type StoredPlace } from '../lib/place';
import { RefProvider, type RefData } from '../lib/ref';

export function Providers({ refData, place, children }: { refData: RefData | null; place: StoredPlace; children: ReactNode }) {
  return (
    <RefProvider data={refData}>
      <PlaceProvider initial={place}>
        <Layout>{children}</Layout>
      </PlaceProvider>
    </RefProvider>
  );
}

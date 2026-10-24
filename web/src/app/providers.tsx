'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '../lib/auth';
import { ContributeProvider } from '../lib/contribute';
import { PlaceProvider, type StoredPlace } from '../lib/place';
import { RefProvider, type RefData } from '../lib/ref';
import { ToastProvider } from '../lib/toast';

export function Providers({ refData, place, children }: { refData: RefData | null; place: StoredPlace; children: ReactNode }) {
  return (
    <RefProvider data={refData}>
      <PlaceProvider initial={place}>
        <ToastProvider>
          <AuthProvider>
            <ContributeProvider>{children}</ContributeProvider>
          </AuthProvider>
        </ToastProvider>
      </PlaceProvider>
    </RefProvider>
  );
}

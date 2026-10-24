import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { getPlaceCookie, getRefData } from '../lib/server';
import { Providers } from './providers';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://6adcc60d0036a5cd4f5c.appwrite.network'),
  title: { default: 'Second Opinion: check before you pay', template: '%s · Second Opinion' },
  description: 'What locals really paid for autos, plumbers, haircuts and street food, near you. Verified, locality-level fair prices for Bhopal, Indore and Mumbai.',
  applicationName: 'Second Opinion',
  openGraph: { type: 'website', siteName: 'Second Opinion', locale: 'en_IN' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [refData, cookiePlace] = await Promise.all([getRefData().catch(() => null), getPlaceCookie()]);
  const valid = cookiePlace && refData?.cities.some((c) => c.$id === cookiePlace.cityId);
  const place = valid ? { ...cookiePlace, source: 'manual' as const } : { cityId: 'bhopal', localityId: null, source: 'default' as const };

  return (
    <html lang="en-IN">
      <body>
        <Providers refData={refData} place={place}>
          {children}
        </Providers>
      </body>
    </html>
  );
}

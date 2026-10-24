import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { SEEN_COOKIE } from '../../lib/seen';
import { LandingPage } from '../../views/LandingPage';

export const metadata: Metadata = {
  title: { absolute: 'Second Opinion: know the fair price before you pay' },
  description: 'What locals really paid for autos, plumbers, haircuts and street food, near you. Verified, locality-level fair prices for Bhopal, Indore and Mumbai.',
  openGraph: { title: 'Know the fair price before you pay', images: ['/og'] },
  twitter: { card: 'summary_large_image', images: ['/og'] },
};

// First-time visitors get the explanation; anyone who has engaged with it lands straight in the tool.
export default async function Home() {
  if ((await cookies()).has(SEEN_COOKIE)) redirect('/check');
  return <LandingPage />;
}

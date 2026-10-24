import type { Metadata } from 'next';
import { LandingPage } from '../../../views/LandingPage';

export const metadata: Metadata = {
  title: { absolute: 'What is Second Opinion?' },
  description: 'A verified, locality-level price layer for the informal economy: what locals really paid, near you.',
  openGraph: { images: ['/og'] },
};

export default function About() {
  return <LandingPage />;
}

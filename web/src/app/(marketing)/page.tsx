import type { Metadata } from 'next';
import { LandingPage } from '../../views/LandingPage';

export const metadata: Metadata = {
  title: { absolute: 'Second Opinion: know the fair price before you pay' },
  description: 'What locals really paid for autos, plumbers, haircuts and street food, near you. Verified, locality-level fair prices for Bhopal, Indore and Mumbai.',
  openGraph: { title: 'Know the fair price before you pay', images: ['/og'] },
  twitter: { card: 'summary_large_image', images: ['/og'] },
};

// The bare address always explains the product. The tool is one tap away ("Open the app") and at /check.
export default function Home() {
  return <LandingPage />;
}

import { getLandingData } from '../lib/landing';
import { Landing } from './Landing';

export async function LandingPage() {
  return <Landing {...await getLandingData()} />;
}

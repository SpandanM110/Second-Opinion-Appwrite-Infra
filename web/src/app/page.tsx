import { CheckPage } from '../views/CheckPage';
import { getCityStats, getPlaceCookie } from '../lib/server';

export default async function Home() {
  const cityId = (await getPlaceCookie())?.cityId ?? 'bhopal';
  const rows = await getCityStats([cityId]).catch(() => undefined);
  return <CheckPage initialStats={rows ? { cityId, rows } : undefined} />;
}

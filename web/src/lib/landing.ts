import 'server-only';
import { getCard, getCityStats, getPlaceCookie, getRefData } from './server';
import type { LandingProps } from '../views/Landing';

// The landing page's hero example is always the same real story: a newcomer's auto from the station.
// Bhopal shows the exact station (Habibganj); the other cities show their city-wide card.
const SIGNATURE_ITEM = 'auto-station-to-centre';
const BHOPAL_STATION = 'bpl-rani-kamlapati-station';

export async function getLandingData(): Promise<LandingProps> {
  const [ref, place] = await Promise.all([getRefData(), getPlaceCookie()]);
  const cityId = place && ref.cities.some((c) => c.$id === place.cityId) ? place.cityId : 'bhopal';
  const localityId = cityId === 'bhopal' ? BHOPAL_STATION : null;

  const [result, allRows] = await Promise.all([
    getCard(ref, SIGNATURE_ITEM, cityId, localityId).catch(() => null),
    getCityStats(ref.cities.map((c) => c.$id)).catch(() => []),
  ]);

  return {
    card: result?.card.status === 'ok' ? result.card : null,
    cardHref: `/item/${SIGNATURE_ITEM}?c=${cityId}${localityId ? `&l=${localityId}` : ''}`,
    cityRows: allRows.filter((r) => r.scope_id === cityId),
    coverage: ref.cities.map((city) => ({ city, stat: allRows.find((r) => r.item_id === SIGNATURE_ITEM && r.scope_id === city.$id) ?? null })),
    apiUrl: `${process.env.NEXT_PUBLIC_FAIR_RANGE_URL ?? 'https://6adcba4a001b8bfea9d0.appwrite.network'}/?item=${SIGNATURE_ITEM}&locality=${BHOPAL_STATION}`,
  };
}

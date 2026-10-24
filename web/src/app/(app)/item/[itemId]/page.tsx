import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CardSkeleton } from '@/components/States';
import { rupees } from '@/lib/format';
import { getCard, getGuideDismissed, getLogs, getPlaceCookie, getRefData, getUsersFor } from '@/lib/server';
import { ItemPage, type ItemInitial } from '@/views/ItemPage';

type Props = { params: Promise<{ itemId: string }>; searchParams: Promise<{ c?: string; l?: string }> };

/** A shared link (?c=&l=) pins the place; otherwise the visitor's own place from the cookie. */
async function where({ params, searchParams }: Props) {
  const [{ itemId }, sp, cookie, ref] = await Promise.all([params, searchParams, getPlaceCookie(), getRefData()]);
  const cityId = sp.c ?? cookie?.cityId ?? 'bhopal';
  const localityId = sp.c ? (sp.l ?? null) : (cookie?.localityId ?? null);
  return { ref, itemId, cityId, localityId };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { ref, itemId, cityId, localityId } = await where(props);
  const result = await getCard(ref, itemId, cityId, localityId); // memoised per request: the page below reuses this fetch
  if (!result) return { title: 'Not found' };
  const { card, item, city, locality } = result;
  const place = locality?.name ?? city.name;
  const og = `/og?item=${itemId}&c=${city.$id}${locality ? `&l=${locality.$id}` : ''}`;
  if (card.status !== 'ok') {
    return { title: `${item.name} in ${place}`, description: card.message, openGraph: { images: [og] } };
  }
  const title = `${item.name} in ${place}: ₹${rupees(card.range.median)}`;
  const description = `Most people paid ₹${rupees(card.range.p25)}–${rupees(card.range.p75)} (${card.item.unitLabel}). ${card.confidence.level[0].toUpperCase()}${card.confidence.level.slice(1)} confidence: ${card.sample.line}.`;
  return { title, description, openGraph: { title, description, images: [og] }, twitter: { card: 'summary_large_image', title, description, images: [og] } };
}

export default async function Page(props: Props) {
  const { ref, itemId, cityId, localityId } = await where(props);

  // The card and both candidate price lists are independent, so they are fetched together; the card's scope
  // (a locality card lists that locality's prices) only decides which list to show.
  const [result, localLogs, cityLogs, guideDismissed] = await Promise.all([
    getCard(ref, itemId, cityId, localityId),
    localityId ? getLogs(itemId, cityId, localityId).catch(() => []) : Promise.resolve(null),
    getLogs(itemId, cityId, null).catch(() => []),
    getGuideDismissed(),
  ]);
  if (!result) notFound();
  const { card, city, locality } = result;

  const logs = card.status === 'ok' && card.scope.type === 'locality' && localLogs ? localLogs : cityLogs;
  const users = await getUsersFor(logs.map((l) => l.user_id)).catch(() => []);
  const initial: ItemInitial = {
    placeKey: `${city.$id}|${locality?.$id ?? ''}`,
    card: { card, fetchedAt: result.fetchedAt, stale: false },
    logs,
    users,
    guideDismissed,
  };
  return (
    <Suspense fallback={<CardSkeleton />}>
      <ItemPage itemId={itemId} initial={initial} />
    </Suspense>
  );
}

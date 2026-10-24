import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CardSkeleton } from '../../../components/States';
import { rupees } from '../../../lib/format';
import { getCard, getPlaceCookie, getRecentLogs, getRefData } from '../../../lib/server';
import { ItemPage, type ItemInitial } from '../../../views/ItemPage';

type Props = { params: Promise<{ itemId: string }>; searchParams: Promise<{ c?: string; l?: string }> };

/** A shared link (?c=&l=) pins the place; otherwise the visitor's own place from the cookie. */
async function resolve({ params, searchParams }: Props) {
  const [{ itemId }, sp, cookie, ref] = await Promise.all([params, searchParams, getPlaceCookie(), getRefData()]);
  const cityId = sp.c ?? cookie?.cityId ?? 'bhopal';
  const localityId = sp.c ? (sp.l ?? null) : (cookie?.localityId ?? null);
  return { itemId, result: await getCard(ref, itemId, cityId, localityId) };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { itemId, result } = await resolve(props);
  if (!result) return { title: 'Not found' };
  const { card, item, city, locality } = result;
  const where = locality?.name ?? city.name;
  const og = `/og?item=${itemId}&c=${city.$id}${locality ? `&l=${locality.$id}` : ''}`;
  if (card.status !== 'ok') {
    return { title: `${item.name} in ${where}`, description: card.message, openGraph: { images: [og] } };
  }
  const title = `${item.name} in ${where}: ₹${rupees(card.range.median)}`;
  const description = `Most people paid ₹${rupees(card.range.p25)}–${rupees(card.range.p75)} (${card.item.unitLabel}). ${card.confidence.level[0].toUpperCase()}${card.confidence.level.slice(1)} confidence: ${card.sample.line}.`;
  return { title, description, openGraph: { title, description, images: [og] }, twitter: { card: 'summary_large_image', title, description, images: [og] } };
}

export default async function Page(props: Props) {
  const { itemId, result } = await resolve(props);
  if (!result) notFound();
  const { card, city, locality } = result;
  const scopeLocality = card.status === 'ok' && card.scope.type === 'locality' ? (locality?.$id ?? null) : null;
  const { logs, users } = await getRecentLogs(itemId, city.$id, scopeLocality).catch(() => ({ logs: [], users: [] }));
  const initial: ItemInitial = {
    placeKey: `${city.$id}|${locality?.$id ?? ''}`,
    card: { card, fetchedAt: result.fetchedAt, stale: false },
    logs,
    users,
  };
  return (
    <Suspense fallback={<CardSkeleton />}>
      <ItemPage itemId={itemId} initial={initial} />
    </Suspense>
  );
}

import { Suspense } from 'react';
import { ListSkeleton } from '@/components/States';
import { getPlaceCookie, getQuestions, getRefData } from '@/lib/server';
import { FeedPage } from '@/views/FeedPage';

export const metadata = { title: 'Feed', description: 'Questions from newcomers (is this quote fair?) and the latest prices paid by locals.' };

type Props = { searchParams: Promise<{ city?: string; tab?: string }> };

// The first tab (questions) is rendered on the server so it paints with the page, not after a second round trip.
export default async function Page({ searchParams }: Props) {
  const [sp, cookie, ref] = await Promise.all([searchParams, getPlaceCookie(), getRefData().catch(() => null)]);
  const cityId = ref?.cities.find((c) => c.$id === sp.city)?.$id ?? cookie?.cityId ?? 'bhopal';
  const data = sp.tab === 'logs' ? null : await getQuestions(cityId).catch(() => null);
  return (
    <Suspense fallback={<ListSkeleton />}>
      <FeedPage initial={data ? { cityId, ...data } : undefined} />
    </Suspense>
  );
}

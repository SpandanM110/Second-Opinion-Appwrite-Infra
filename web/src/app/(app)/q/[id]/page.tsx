import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ListSkeleton } from '@/components/States';
import { rupees } from '@/lib/format';
import { getQuestion, getRefData } from '@/lib/server';
import { QuoteCheckPage } from '@/views/QuoteCheckPage';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [data, ref] = await Promise.all([getQuestion(id).catch(() => null), getRefData().catch(() => null)]);
  if (!data) return { title: 'Is this quote fair?' };
  const item = ref?.items.find((i) => i.$id === data.qc.item_id)?.name ?? 'a price';
  const place = ref?.localities.find((l) => l.$id === data.qc.locality_id)?.name ?? ref?.cities.find((c) => c.$id === data.qc.city_id)?.name ?? '';
  return { title: `Is ₹${rupees(data.qc.quoted_price)} fair? · ${item}${place ? ` in ${place}` : ''}`, description: data.qc.body || undefined };
}

// The question and its answers are rendered on the server, so the page paints with content; new answers still
// arrive live in the browser. A missing id falls through to the client, which shows the not-found view.
export default async function Page({ params }: Props) {
  const { id } = await params;
  const data = await getQuestion(id).catch(() => null);
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <QuoteCheckPage id={id} initial={data ?? undefined} />
    </Suspense>
  );
}

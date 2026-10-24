import { Suspense } from 'react';
import { ComparePage } from '../../../views/ComparePage';

export const metadata = { title: 'Compare cities' };

export default async function Page({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  return (
    <Suspense>
      <ComparePage itemId={itemId} />
    </Suspense>
  );
}

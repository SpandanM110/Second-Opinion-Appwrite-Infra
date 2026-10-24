import { Suspense } from 'react';
import { ComparePage } from '@/views/ComparePage';

export const metadata = { title: 'Compare cities', description: 'Recalibrate before you bargain: what the same thing costs in Bhopal, Indore and Mumbai.' };

export default function Page() {
  return (
    <Suspense>
      <ComparePage />
    </Suspense>
  );
}

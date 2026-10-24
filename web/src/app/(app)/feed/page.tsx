import { Suspense } from 'react';
import { FeedPage } from '@/views/FeedPage';

export const metadata = { title: 'Feed', description: 'Questions from newcomers (is this quote fair?) and the latest prices paid by locals.' };

export default function Page() {
  return (
    <Suspense>
      <FeedPage />
    </Suspense>
  );
}

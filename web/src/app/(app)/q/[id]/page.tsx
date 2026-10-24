import { QuoteCheckPage } from '@/views/QuoteCheckPage';

export const metadata = { title: 'Is this quote fair?' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <QuoteCheckPage id={(await params).id} />;
}

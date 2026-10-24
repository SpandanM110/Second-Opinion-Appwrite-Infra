import { MarketingHeader } from '../components/marketing/Chrome';
import { NotFound } from '../views/NotFound';

export default function Page() {
  return (
    <>
      <MarketingHeader minimal />
      <main id="main" className="px-4">
        <NotFound />
      </main>
    </>
  );
}

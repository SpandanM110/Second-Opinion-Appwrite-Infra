import type { ReactNode } from 'react';
import { MarketingFooter, MarketingHeader } from '../../components/marketing/Chrome';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <MarketingHeader />
      <main id="main">{children}</main>
      <MarketingFooter />
    </div>
  );
}

import type { ReactNode } from 'react';
import { MarketingFooter, MarketingHeader } from '../../components/marketing/Chrome';
import { MarkSeen } from '../../components/marketing/MarkSeen';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <MarkSeen />
      <MarketingHeader />
      <main id="main">{children}</main>
      <MarketingFooter />
    </div>
  );
}

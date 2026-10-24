import Link from 'next/link';
import { Logo } from '../Logo';

const NAV = [
  ['/about#how', 'How it works'],
  ['/about#trust', 'Trust'],
  ['/about#locals', 'For locals'],
  ['/api', 'API'],
  ['/about#faq', 'FAQ'],
] as const;

export function MarketingHeader({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
        <Link href="/about" className="tap flex items-center gap-2 font-semibold tracking-tight" aria-label="Second Opinion, home">
          <Logo />
          <span className="text-[17px]">Second Opinion</span>
        </Link>
        <nav className={`ml-auto items-center gap-1 ${minimal ? 'hidden' : 'hidden lg:flex'}`} aria-label="Page sections">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="tap inline-flex items-center rounded-lg px-3 text-[15px] font-medium text-muted hover:text-ink">
              {label}
            </Link>
          ))}
        </nav>
        <Link href="/check" className="btn-primary ml-auto h-10 px-4 text-[14px] lg:ml-2">
          Open the app
        </Link>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-surface px-4 py-10 text-[14px] text-muted">
      <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2 font-semibold text-ink">
            <Logo size={24} /> Second Opinion
          </p>
          <p className="mt-2 max-w-xs">A verified, locality-level price layer for everything that isn’t on an app.</p>
          <p className="mt-3 max-w-xs text-[13px] text-faint">
            Demo data for the hackathon; real prices start now.{' '}
            <Link className="underline underline-offset-2" href="/about#data">
              How it was made
            </Link>
          </p>
        </div>
        <nav aria-label="Product">
          <p className="mb-2 font-semibold text-ink">Product</p>
          <ul className="space-y-1">
            <li>
              <Link href="/check" className="tap inline-flex items-center hover:underline">
                Check a price
              </Link>
            </li>
            <li>
              <Link href="/feed" className="tap inline-flex items-center hover:underline">
                Questions and prices
              </Link>
            </li>
            <li>
              <Link href="/compare" className="tap inline-flex items-center hover:underline">
                Compare cities
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Build">
          <p className="mb-2 font-semibold text-ink">Build</p>
          <ul className="space-y-1">
            <li>
              <Link href="/api" className="tap inline-flex items-center hover:underline">
                API
              </Link>
            </li>
            <li>
              <a href="https://github.com/SpandanM110/Second-Opinion-Appwrite-Infra" target="_blank" rel="noreferrer" className="tap inline-flex items-center hover:underline">
                GitHub
              </a>
            </li>
          </ul>
          <p className="mt-3 text-[13px] text-faint">Built on Appwrite TablesDB, Functions, Realtime, Storage and Sites.</p>
        </nav>
      </div>
    </footer>
  );
}

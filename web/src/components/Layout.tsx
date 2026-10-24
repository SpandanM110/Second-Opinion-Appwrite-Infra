'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowLeftRight, Code2, Home, Newspaper, UserRound } from 'lucide-react';
import { FAIR_RANGE_URL } from '../lib/appwrite';
import { useRefData } from '../lib/ref';

const TABS = [
  { to: '/', label: 'Check', Icon: Home },
  { to: '/feed', label: 'Feed', Icon: Newspaper },
  { to: '/compare', label: 'Compare', Icon: ArrowLeftRight },
  { to: '/me', label: 'Me', Icon: UserRound },
];

const isActive = (pathname: string, to: string) => (to === '/' ? pathname === '/' || pathname.startsWith('/item') : pathname.startsWith(to));

export function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ref = useRefData();

  return (
    <div className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+96px)] md:pb-6">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Link href="/" className="tap flex items-center gap-2 font-semibold tracking-tight" aria-label="Second Opinion, home">
            <Logo />
            <span className="text-[17px]">Second Opinion</span>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Main">
            {TABS.map(({ to, label }) => (
              <Link
                key={to}
                href={to}
                aria-current={isActive(pathname, to) ? 'page' : undefined}
                className={`tap inline-flex items-center rounded-lg px-3 text-[15px] font-medium ${isActive(pathname, to) ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:text-ink'}`}
              >
                {label}
              </Link>
            ))}
            <a href={`${FAIR_RANGE_URL}/`} target="_blank" rel="noreferrer" className="tap inline-flex items-center gap-1.5 rounded-lg px-3 text-[15px] font-medium text-muted hover:text-ink">
              <Code2 size={16} aria-hidden /> API
            </a>
          </nav>
        </div>
      </header>

      {ref.error && (
        <p className="mx-auto max-w-5xl px-4 pt-3 text-[14px] text-warn" role="alert">
          {ref.error}
        </p>
      )}

      <main id="main" className="mx-auto max-w-5xl px-4 pt-4 sm:pt-6">
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+60px)] z-20 md:static md:mx-auto md:mt-12 md:max-w-5xl md:px-4">
        <p className="mx-auto w-fit max-w-[calc(100%-16px)] rounded-t-lg bg-ink/85 px-3 py-1 text-center text-[12px] text-white md:max-w-none md:rounded-lg md:bg-transparent md:text-faint">
          <span className="sm:hidden">Demo data, real logs start now.</span>
          <span className="hidden sm:inline">Demo data for the hackathon; real logs start now.</span>{' '}
          <a className="underline underline-offset-2" href="https://github.com/SpandanM110/Second-Opinion-Appwrite-Infra#demo-data" target="_blank" rel="noreferrer">
            How it was made
          </a>
        </p>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
        <ul className="grid h-[60px] grid-cols-4">
          {TABS.map(({ to, label, Icon }) => {
            const active = isActive(pathname, to);
            return (
              <li key={to}>
                <Link
                  href={to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-0.5 text-[12px] font-medium ${active ? 'text-accent-ink' : 'text-faint'}`}
                >
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#3730a3" />
      <rect x="5" y="14" width="22" height="4" rx="2" fill="#818cf8" />
      <rect x="10" y="12.5" width="12" height="7" rx="3.5" fill="#c7d2fe" />
      <rect x="15" y="8" width="2.5" height="16" rx="1.25" fill="#fff" />
    </svg>
  );
}

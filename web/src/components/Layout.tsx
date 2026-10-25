'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowLeftRight, CircleHelp, Home, Newspaper, PenLine, UserRound } from 'lucide-react';
import { useContribute } from '../lib/contribute';
import { useRefData } from '../lib/ref';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const TABS = [
  { to: '/check', label: 'Check', Icon: Home },
  { to: '/feed', label: 'Feed', Icon: Newspaper },
  { to: '/compare', label: 'Compare', Icon: ArrowLeftRight },
  { to: '/me', label: 'Me', Icon: UserRound },
];

const isActive = (pathname: string, to: string) => (to === '/check' ? pathname.startsWith('/check') || pathname.startsWith('/item') : pathname.startsWith(to));

export function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ref = useRefData();
  const contribute = useContribute();
  // The card has its own "Add my price"; Me and the question page have their own actions.
  const showFab = !pathname.startsWith('/item') && !pathname.startsWith('/me') && !pathname.startsWith('/q/');

  return (
    <div className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+84px)] md:pb-6">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-4">
          <Link href="/check" className="tap flex items-center gap-2 font-semibold tracking-tight" aria-label="Second Opinion, home">
            <Logo />
            <span className="text-[17px]">Second Opinion</span>
          </Link>
          <Link
            href="/about#data"
            className="inline-flex h-6 items-center rounded-full bg-low-soft px-2 text-[11px] font-semibold text-low hover:bg-line"
            title="This is demo data. Tap to see how it was made."
          >
            <span className="sm:hidden">Demo</span>
            <span className="hidden sm:inline">Demo data</span>
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
            <Link href="/about" className="tap inline-flex items-center rounded-lg px-3 text-[15px] font-medium text-muted hover:text-ink">
              What is this?
            </Link>
          </nav>
          <Link href="/about" className="tap ml-auto inline-flex items-center justify-center rounded-lg text-muted hover:text-ink md:hidden" aria-label="What is this?">
            <CircleHelp size={22} aria-hidden />
          </Link>
          <ThemeToggle />
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

      <footer className="mx-auto mt-12 max-w-5xl px-4 text-center text-[13px] text-faint">
        <p>
          Demo data for the hackathon; real prices start now.{' '}
          <Link className="underline underline-offset-2" href="/about#data">
            How it was made
          </Link>
        </p>
        <p className="mt-1">
          <Link className="underline underline-offset-2" href="/about">
            What is this?
          </Link>
          {' · '}
          <Link className="underline underline-offset-2" href="/api">
            API
          </Link>
          {' · '}
          <a className="underline underline-offset-2" href="https://github.com/SpandanM110/Second-Opinion-Appwrite-Infra" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </p>
      </footer>

      {showFab && (
        <button
          type="button"
          onClick={() => void contribute.openLog()}
          className="btn-primary fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] right-4 z-20 h-12 rounded-full px-5 shadow-lg md:bottom-6"
        >
          <PenLine size={18} aria-hidden /> Share a price
        </button>
      )}

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

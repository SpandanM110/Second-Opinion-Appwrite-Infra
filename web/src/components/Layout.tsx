'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowLeft, Home, MessageCircleQuestion, PenLine, UserRound } from 'lucide-react';
import { AppBarProvider, useAppBarState } from '../lib/appbar';
import { useContribute } from '../lib/contribute';
import { useBack, useNavigationCounter } from '../lib/nav';
import { useRefData } from '../lib/ref';
import { Logo } from './Logo';
import { PlaceChip } from './PlacePicker';

const TABS = [
  { to: '/check', label: 'Check', Icon: Home },
  { to: '/feed', label: 'Ask', Icon: MessageCircleQuestion },
  { to: '/me', label: 'Me', Icon: UserRound },
];

const isActive = (pathname: string, to: string) => {
  if (to === '/check') return pathname.startsWith('/check') || pathname.startsWith('/item');
  if (to === '/feed') return pathname.startsWith('/feed') || pathname.startsWith('/q/');
  return pathname.startsWith(to);
};

// Root tabs show the logo and the area chip; everything else is a sub-page with a back button and a title.
const ROOT = /^\/(check|feed|me)\/?$|^\/compare/;

export function Layout({ children }: { children: ReactNode }) {
  return (
    <AppBarProvider>
      <Shell>{children}</Shell>
    </AppBarProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ref = useRefData();
  const contribute = useContribute();
  const bar = useAppBarState();
  useNavigationCounter();
  const root = ROOT.test(pathname);
  // The card's title is known from the route alone, so the server HTML already carries it.
  const itemTitle = pathname.startsWith('/item/') ? ref.item(decodeURIComponent(pathname.split('/')[2] ?? ''))?.name : undefined;
  const title = bar.title ?? itemTitle;
  const back = useBack(bar.back ?? '/check');

  return (
    <div className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+var(--tabs-h)+20px)] md:pb-6">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex h-[var(--bar-h)] max-w-5xl items-center gap-2 px-4 sm:gap-3">
          {root ? (
            <>
              <Link href="/check" className="tap flex shrink-0 items-center gap-2 font-semibold tracking-tight" aria-label="Second Opinion, home">
                <Logo />
                <span className={`text-[17px] ${pathname.startsWith('/me') ? '' : 'hidden sm:inline'}`}>Second Opinion</span>
              </Link>
              {/* The one piece of context every screen depends on: where you are checking. */}
              {!pathname.startsWith('/me') && <PlaceChip className="min-w-0 max-w-[62vw] sm:max-w-xs" />}
            </>
          ) : (
            <>
              <button type="button" onClick={back} className="tap -ml-2 inline-flex shrink-0 items-center justify-center rounded-lg text-ink hover:bg-canvas" aria-label="Back">
                <ArrowLeft size={22} aria-hidden />
              </button>
              {/* Not a heading: each page keeps its own h1 in the content. */}
              <p className="min-w-0 flex-1 truncate text-[17px] font-semibold">{title ?? ''}</p>
              {bar.action && <div className="shrink-0">{bar.action}</div>}
            </>
          )}

          {/* Desktop: text tabs and the primary action live in the bar. */}
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Main">
            {[...TABS, { to: '/compare', label: 'Compare' }].map(({ to, label }) => (
              <Link
                key={to}
                href={to}
                aria-current={isActive(pathname, to) ? 'page' : undefined}
                className={`tap inline-flex items-center rounded-lg px-3 text-[15px] font-medium ${isActive(pathname, to) ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:text-ink'}`}
              >
                {label}
              </Link>
            ))}
            <button type="button" onClick={() => void contribute.openLog()} className="btn-primary ml-2 h-10 px-4 text-[14px]">
              <PenLine size={16} aria-hidden /> Share a price
            </button>
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

      {/* Phones: Check · Ask · Share · Me. The raised centre button is the one primary action, on every page. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Tabs">
        <ul className="grid h-[var(--tabs-h)] grid-cols-4">
          {TABS.slice(0, 2).map((t) => (
            <Tab key={t.to} {...t} active={isActive(pathname, t.to)} />
          ))}
          <li>
            <button
              type="button"
              onClick={() => void contribute.openLog()}
              className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[12px] font-medium text-accent-ink"
            >
              <span className="-mt-7 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-lg ring-4 ring-canvas" aria-hidden>
                <PenLine size={24} />
              </span>
              <span aria-hidden>Share</span>
              <span className="sr-only">Share a price</span>
            </button>
          </li>
          {TABS.slice(2).map((t) => (
            <Tab key={t.to} {...t} active={isActive(pathname, t.to)} />
          ))}
        </ul>
      </nav>
    </div>
  );
}

function Tab({ to, label, Icon, active }: (typeof TABS)[number] & { active: boolean }) {
  return (
    <li>
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
}

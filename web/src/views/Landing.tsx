import Link from 'next/link';
import { ArrowRight, Check, Clock, Code2, EyeOff, Flag, PenLine, Receipt, Scale, Search, ShieldCheck, X } from 'lucide-react';
import { CityChips } from '../components/marketing/CityChips';
import { LandingSearch } from '../components/marketing/LandingSearch';
import { CardNotes, MiniProof, StaticCard } from '../components/marketing/StaticCard';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { band, Price } from '../components/Price';
import type { CardOk, City, PriceStat } from '../lib/types';

export interface LandingProps {
  card: CardOk | null;
  cardHref: string;
  cityRows: PriceStat[];
  coverage: { city: City; stat: PriceStat | null }[];
  apiUrl: string;
}

const SIGNATURE_ITEM = 'auto-station-to-centre';

const AI_ROWS = [
                  ['How local', 'A city-wide ballpark, often years old', 'Your area, the last 90 days'],
                  ['Where the number comes from', 'One figure, no sample behind it', 'A range, with how many people and how recent'],
                  ['Can a local correct it?', 'No', 'Yes: confirm, flag, and the range self-corrects'],
                ] as const;

export function Landing({ card, cardHref, cityRows, coverage, apiUrl }: LandingProps) {
  const sample = card
    ? JSON.stringify(
        {
          status: card.status,
          item: { id: card.item.id, name: card.item.name, unitLabel: card.item.unitLabel },
          scope: { type: card.scope.type, label: card.scope.label },
          range: { median: card.range.median, p25: card.range.p25, p75: card.range.p75 },
          confidence: { level: card.confidence.level, reason: card.confidence.reason },
          overcharge: card.overcharge,
        },
        null,
        2,
      )
    : null;

  return (
    <>
      {/* 1 · Hero */}
      <section className="px-4 pb-10 pt-8 sm:pb-16 sm:pt-14" aria-labelledby="hero-title">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[13px] font-semibold text-accent-ink">
              Bhopal · Indore · Mumbai
            </p>
            <h1 id="hero-title" className="mt-4 text-[36px] font-bold leading-[1.08] tracking-tight sm:text-[52px]">
              Know the fair price before you pay.
            </h1>
            <p className="mt-4 max-w-xl text-[18px] leading-relaxed text-muted">
              Autos, plumbers, haircuts and chai, priced by locals who actually paid. No meter, no menu, no problem.
            </p>
            <p lang="hi" className="mt-1 text-[15px] text-faint">
              पैसे देने से पहले सही दाम जानिए।
            </p>
            {card && <MiniProof card={card} href={cardHref} />}

            <div className="mt-6 space-y-5">
              <CityChips />
              <div>
                <p className="mb-2 text-[13px] font-semibold text-muted">What are you about to pay for?</p>
                <LandingSearch rows={cityRows} />
                <p className="mt-2 text-[13px] text-faint">Try “auto”, “plumber”, “haircut” or “चाय”. No account needed.</p>
              </div>
            </div>
          </div>

          <div aria-label="A real example">
            {card ? (
              <>
                <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-muted">
                  A real example <span className="rounded-full bg-low-soft px-2 py-0.5 text-[11px] text-low">demo data</span>
                </p>
                <StaticCard card={card} href={cardHref} />
              </>
            ) : null}
          </div>
        </div>
        {card && (
          <div className="mx-auto mt-8 max-w-5xl rounded-2xl bg-surface p-4 sm:p-6">
            <h2 className="mb-3 text-[15px] font-semibold">How to read that card</h2>
            <CardNotes withQuotes={Boolean(card.overcharge)} />
          </div>
        )}
      </section>

      {/* 2 · The problem */}
      <section className="border-y border-line bg-surface px-4 py-12 sm:py-16" aria-labelledby="problem">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="problem" className="text-[28px] font-bold tracking-tight sm:text-[36px]">
            No meter. No menu. No price.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">
            Most everyday purchases in an Indian city have no listed price. The same auto ride, plumber visit or haircut costs different people very different amounts, and the people who know least, newcomers and travellers, pay the most.
          </p>
          <p className="mt-3 text-[17px] leading-relaxed text-muted">
            The knowledge exists. Locals have it. It has just never been written down anywhere you can search.
          </p>
        </div>
      </section>

      {/* 3 · How it works */}
      <section id="how" className="scroll-mt-20 px-4 py-12 sm:py-16" aria-labelledby="how-title">
        <div className="mx-auto max-w-5xl">
          <h2 id="how-title" className="text-[28px] font-bold tracking-tight sm:text-[36px]">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { Icon: Search, t: 'Check', d: 'Search the item. See the fair price for your area, and how far to trust it.' },
              { Icon: Scale, t: 'Use it', d: 'Know where to start, what to settle at, and when to walk away. Or ask locals if a quote is fair.' },
              { Icon: PenLine, t: 'Share', d: 'Paid something? Add it in 20 seconds. The next person benefits.' },
              { Icon: ShieldCheck, t: 'Verify', d: 'Locals confirm or flag prices. Three flags and a bad number is out.' },
            ].map(({ Icon, t, d }, i) => (
              <li key={t} className="panel p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
                  <Icon size={20} aria-hidden />
                </span>
                <p className="mt-3 text-[13px] font-semibold text-faint">Step {i + 1}</p>
                <h3 className="text-[18px] font-semibold">{t}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4 · Trust */}
      <section id="trust" className="scroll-mt-20 border-y border-line bg-surface px-4 py-12 sm:py-16" aria-labelledby="trust-title">
        <div className="mx-auto max-w-5xl">
          <h2 id="trust-title" className="text-[28px] font-bold tracking-tight sm:text-[36px]">
            Why you can trust a number
          </h2>
          <p className="mt-3 max-w-2xl text-[17px] text-muted">We never show a bare number. Every price tells you how much to rely on it.</p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { level: 'high' as const, t: 'High confidence', d: 'Plenty of recent prices from several people, tightly grouped. Safe to negotiate from.', ex: '26 prices from 17 people' },
              { level: 'medium' as const, t: 'Medium confidence', d: 'A solid ballpark, but fewer, older or more spread-out prices. Good for a first guess.', ex: '9 prices from 4 people' },
              { level: 'low' as const, t: 'Low confidence', d: 'Too little data to be sure. We say so, and ask you to add what you paid.', ex: 'only 3 prices so far' },
            ].map((c) => (
              <div key={c.level} className="rounded-2xl border border-line p-5">
                <ConfidenceBadge level={c.level} reason={c.ex} compact />
                <h3 className="mt-3 text-[17px] font-semibold">{c.t}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-muted">{c.d}</p>
                <p className="mt-3 text-[13px] text-faint">Example: {c.ex}</p>
              </div>
            ))}
          </div>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              [Clock, 'Only the last 90 days count, and older prices fade, so last year’s rate never misleads you.'],
              [Scale, 'You see the range most people paid, not an average a single odd price can drag around.'],
              [Receipt, 'Prices with a receipt, and from people with a good record, count more. Receipts stay private.'],
              [Flag, 'Neighbours confirm good prices and flag bad ones. Three flags hide a price from every range.'],
              [EyeOff, 'No shop names, ever. A price belongs to an item and an area, never to a person or a business.'],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof Clock;
              return (
                <li key={i} className="flex items-start gap-3 text-[15px] text-muted">
                  <I size={20} className="mt-0.5 shrink-0 text-accent-ink" aria-hidden />
                  <span>{text as string}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 5 · Versus a general-purpose assistant */}
      <section className="px-4 py-12 sm:py-16" aria-labelledby="ai-title">
        <div className="mx-auto max-w-4xl">
          <h2 id="ai-title" className="text-[28px] font-bold tracking-tight sm:text-[36px]">
            Not another AI guess
          </h2>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted">
            An assistant can tell you a city is expensive and give good bargaining tips. What it can’t tell you is what people paid for this exact ride this month, because that was never written down where it can read it. That’s the layer we’re building.
          </p>
          <div className="mt-8 hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
            <table className="w-full text-left text-[15px]">
              <thead className="bg-canvas text-[12px] uppercase tracking-wide text-faint">
                <tr>
                  <th scope="col" className="w-1/4 px-4 py-3 font-semibold">
                    <span className="sr-only">What we compare</span>
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">A general assistant</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-accent-ink">Second Opinion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {AI_ROWS.map(([k, a, b]) => (
                  <tr key={k}>
                    <th scope="row" className="px-4 py-3 text-[13px] font-semibold text-muted">{k}</th>
                    <td className="px-4 py-3 text-muted">
                      <span className="mr-1.5 inline-block align-middle text-faint"><X size={14} aria-hidden /></span>
                      {a}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <span className="mr-1.5 inline-block align-middle text-high"><Check size={14} aria-hidden /></span>
                      {b}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-8 space-y-3 md:hidden">
            {AI_ROWS.map(([k, a, b]) => (
              <li key={k} className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-[13px] font-semibold text-muted">{k}</p>
                <p className="mt-2 flex items-start gap-2 text-[15px] text-muted">
                  <X size={16} className="mt-0.5 shrink-0 text-faint" aria-hidden /> <span><span className="sr-only">A general assistant: </span>{a}</span>
                </p>
                <p className="mt-1.5 flex items-start gap-2 text-[15px] font-medium">
                  <Check size={16} className="mt-0.5 shrink-0 text-high" aria-hidden /> <span><span className="sr-only">Second Opinion: </span>{b}</span>
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[14px] text-faint">The two work together: the same numbers are available to any app or assistant through an API (below).</p>
        </div>
      </section>

      {/* 6 · Coverage */}
      <section className="border-y border-line bg-surface px-4 py-12 sm:py-16" aria-labelledby="where-title">
        <div className="mx-auto max-w-5xl">
          <h2 id="where-title" className="text-[28px] font-bold tracking-tight sm:text-[36px]">
            Same ride, three cities
          </h2>
          <p className="mt-3 text-[17px] text-muted">Auto from the railway station to the city centre. Tap a city to see its card.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {coverage.map(({ city, stat }) => (
              <li key={city.$id}>
                <Link href={`/item/${SIGNATURE_ITEM}?c=${city.$id}`} className="panel block p-5 transition-shadow hover:shadow-md">
                  <p className="text-[14px] font-semibold text-muted">{city.name}</p>
                  {stat ? (
                    <>
                      <div className="mt-2">
                        <Price value={stat.median} size="lg" />
                      </div>
                      <p className="num mt-1 text-[14px] text-muted">most paid {band(stat.p25, stat.p75)}</p>
                      <p className="mt-3 text-[12px] text-faint">
                        {stat.n_raw} prices from {stat.distinct_users} people
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-[15px] text-muted">Coming soon</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[14px] text-muted">More cities open as locals show up. Not yours yet? Check back; it starts with one person answering a question.</p>
        </div>
      </section>

      {/* 7 · For locals */}
      <section id="locals" className="scroll-mt-20 px-4 py-12 sm:py-16" aria-labelledby="locals-title">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 id="locals-title" className="text-[28px] font-bold tracking-tight sm:text-[36px]">
              You already know what things cost.
            </h2>
            <p className="mt-3 text-[17px] leading-relaxed text-muted">
              You paid ₹100 for the auto and nobody else will ever know it was fair. Logging takes about 20 seconds: pick the item, type the amount, save. Your price helps the next newcomer, and your standing grows each time a neighbour confirms it.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/u/seed-u01" className="btn-secondary">See a trusted local’s profile</Link>
              <Link href="/me" className="btn-ghost">How standing works <ArrowRight size={16} aria-hidden /></Link>
            </div>
          </div>
          <ol className="space-y-3" aria-label="How you earn standing">
            {[
              ['Newcomer', 'Your first 10 prices count at half weight, so one account can’t move a range.'],
              ['Regular', 'From your 10th price, you count in full.'],
              ['Trusted local', 'Each confirmation raises your standing. At 2.0 your prices count more than a stranger’s.'],
            ].map(([t, d], i) => (
              <li key={t} className="panel flex items-start gap-4 p-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[14px] font-bold text-white">{i + 1}</span>
                <div>
                  <p className="text-[16px] font-semibold">{t}</p>
                  <p className="text-[14px] text-muted">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 8 · Developers */}
      <section id="developers" className="scroll-mt-20 border-y border-line bg-ink px-4 py-12 text-white sm:py-16" aria-labelledby="dev-title">
        <div className="mx-auto max-w-5xl">
          <h2 id="dev-title" className="flex items-center gap-3 text-[28px] font-bold tracking-tight sm:text-[36px]">
            <Code2 aria-hidden /> Built to be asked
          </h2>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-white/75">
            The card above is also an API: public, read-only, no key. Any app or AI assistant can ask Second Opinion what the fair price is. An MCP server is on the roadmap.
          </p>
          <p className="mt-3">
            <Link href="/api" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-white underline underline-offset-4">
              Read the API reference and try it <ArrowRight size={16} aria-hidden />
            </Link>
          </p>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
            <div className="min-w-0">
              <p className="mb-2 text-[13px] font-semibold text-white/60">Request</p>
              <pre tabIndex={0} className="overflow-x-auto rounded-xl bg-white/10 p-4 text-[13px] leading-relaxed"><code>curl "{apiUrl}"</code></pre>
            </div>
            {sample && (
              <div className="min-w-0">
                <p className="mb-2 text-[13px] font-semibold text-white/60">Response (shortened)</p>
                <pre tabIndex={0} className="overflow-x-auto rounded-xl bg-white/10 p-4 text-[13px] leading-relaxed"><code>{sample}</code></pre>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 9 · FAQ */}
      <section id="faq" className="scroll-mt-20 px-4 py-12 sm:py-16" aria-labelledby="faq-title">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq-title" className="text-[28px] font-bold tracking-tight sm:text-[36px]">
            Questions
          </h2>
          <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
            {[
              ['Do I need an account?', 'Not to check prices. Sign in only to share a price, confirm or flag one, or ask a question.', false, undefined],
              [
                'Is the data real?',
                'Right now, no: the prices you see are demo data. About 2,000 prices were generated from realistic base rates with natural variation across the three cities, along with 40 sample accounts and 15 sample questions. All of it is labelled in the app. Real prices start the moment people log them, and they will replace the demo data as they arrive.',
                true,
                'data',
              ],
              ['How do you stop fake or silly prices?', 'Prices are weighted by the author’s record. New accounts count at half weight, receipts count double, old prices fade, one odd price barely moves a range, and three flags hide a price completely.', false, undefined],
              ['Why no shop names?', 'Prices belong to an item and an area, never to a person or a business. It keeps the data fair and protects everyone from false accusations.', false, undefined],
              ['My city isn’t listed.', 'We start with Bhopal, Indore and Mumbai and add cities as locals show up.', false, undefined],
            ].map(([q, a, open, id]) => (
              <details key={q as string} id={id as string | undefined} open={open as boolean} className="group scroll-mt-24 px-5 py-1">
                <summary className="tap flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-[16px] font-semibold marker:hidden">
                  {q as string}
                  <span className="text-faint transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="pb-4 text-[15px] leading-relaxed text-muted">{a as string}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 10 · Final call to action */}
      <section className="px-4 pb-16" aria-labelledby="cta-title">
        <div className="mx-auto max-w-5xl rounded-3xl bg-accent px-6 py-12 text-center text-white sm:py-16">
          <h2 id="cta-title" className="text-[28px] font-bold tracking-tight sm:text-[36px]">
            Check a price in ten seconds.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[17px] text-white/80">Free, no account, built on what your neighbours actually paid.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/check" className="btn bg-white text-accent-ink hover:bg-accent-soft">
              Open the app <ArrowRight size={16} aria-hidden />
            </Link>
            <Link href="/feed" className="btn border border-white/40 text-white hover:bg-white/10">
              See questions being answered
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

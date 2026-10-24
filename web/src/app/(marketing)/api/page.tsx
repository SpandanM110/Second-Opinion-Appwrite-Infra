import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { TryIt } from '../../../components/marketing/TryIt';
import { FAIR_RANGE_URL } from '../../../lib/appwrite';

export const metadata: Metadata = {
  title: { absolute: 'Second Opinion API: fair prices for the informal economy' },
  description: 'A public, read-only endpoint that returns the fair price, typical range and confidence for an item at a place. No key needed.',
};

const PARAMS = [
  ['item', 'required', 'The item’s slug (auto-per-km) or an alias (auto, tuk tuk, चाय). Call with no parameters for the full list.'],
  ['lat, lng', 'one of these', 'Coordinates. Resolved to the nearest locality within 3 km and city within 40 km.'],
  ['locality', 'one of these', 'A locality id, such as bpl-mp-nagar.'],
  ['city', 'one of these', 'A city id: bhopal, indore or mumbai.'],
];

const FIELDS = [
  ['status', '“ok”, or “no_data” when nobody has logged this here yet.'],
  ['scope.type / label', 'How local the number is: locality, city or state. A fallback is labelled and capped at Medium confidence.'],
  ['range.median', 'The typical price in rupees. p25–p75 is what most people paid; p10 and p90 are the tails.'],
  ['confidence.level / reason', 'high, medium or low, with a sentence saying why.'],
  ['sample', 'How many prices from how many people, and when the newest one was added.'],
  ['overcharge', 'How much sellers’ first quotes exceed the fair price here (present only when it is at least 1.2x).'],
  ['api.demoData', 'True while the prices are the hackathon’s demo data.'],
];

const ERRORS = [
  ['200', 'A card.'],
  ['400', 'Missing or invalid parameters.'],
  ['404', 'Unknown item (with suggestions), or no data here yet.'],
  ['422', 'The coordinates are outside Bhopal, Indore and Mumbai.'],
  ['429', 'More than 60 requests a minute from one address.'],
];

export default function ApiPage() {
  return (
    <div className="px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <Link href="/about" className="tap -ml-2 inline-flex items-center gap-1 rounded-lg px-2 text-[15px] font-medium text-muted hover:text-ink">
            <ArrowLeft size={18} aria-hidden /> What is Second Opinion?
          </Link>
          <h1 className="mt-4 text-[32px] font-bold leading-tight tracking-tight sm:text-[44px]">The fair-price API</h1>
          <p className="mt-3 text-[17px] leading-relaxed text-muted">
            Ask what a price should be, for an item at a place, and get the typical range and how much to trust it. The same model the app shows. Public, read-only, no key, CORS enabled, answers in about half a second.
          </p>

          <section className="mt-8" aria-labelledby="try">
            <h2 id="try" className="mb-3 text-[20px] font-semibold">
              Try it
            </h2>
            <TryIt />
          </section>

          <section className="mt-10" aria-labelledby="req">
            <h2 id="req" className="text-[20px] font-semibold">
              Request
            </h2>
            <pre tabIndex={0} className="mt-3 overflow-x-auto rounded-xl bg-canvas p-4 text-[13px]">
              <code>GET {FAIR_RANGE_URL}/?item=&lt;slug&gt;&amp;lat=&lt;lat&gt;&amp;lng=&lt;lng&gt;</code>
            </pre>
            <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
              <table className="w-full text-left text-[14px]">
                <thead className="bg-canvas text-[12px] uppercase tracking-wide text-faint">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-semibold">Parameter</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Needed</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line align-top">
                  {PARAMS.map(([k, need, d]) => (
                    <tr key={k}>
                      <th scope="row" className="px-4 py-2.5 font-mono text-[13px] font-semibold">{k}</th>
                      <td className="px-4 py-2.5 text-muted">{need}</td>
                      <td className="px-4 py-2.5 text-muted">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-10" aria-labelledby="res">
            <h2 id="res" className="text-[20px] font-semibold">
              Response
            </h2>
            <dl className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
              {FIELDS.map(([k, d]) => (
                <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[220px_1fr]">
                  <dt className="font-mono text-[13px] font-semibold">{k}</dt>
                  <dd className="text-[14px] text-muted">{d}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-6 text-[16px] font-semibold">Status codes</h3>
            <dl className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
              {ERRORS.map(([k, d]) => (
                <div key={k} className="grid grid-cols-[64px_1fr] gap-2 px-4 py-2.5">
                  <dt className="font-mono text-[13px] font-semibold">{k}</dt>
                  <dd className="text-[14px] text-muted">{d}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-10 rounded-2xl bg-accent-soft p-5" aria-labelledby="mcp">
            <h2 id="mcp" className="text-[18px] font-semibold text-accent-ink">
              Next: an MCP server
            </h2>
            <p className="mt-1 text-[15px] text-muted">
              So an AI assistant can answer “is ₹300 fair from the station?” with the number and the people behind it. Today you can call the endpoint above from any tool that makes HTTP requests.
            </p>
          </section>
        </div>
    </div>
  );
}

import Link from 'next/link';
import { LogIn } from 'lucide-react';

const LADDER = [
  ['Newcomer', 'Your first 10 prices count at half weight, so one account can’t move a range.'],
  ['Regular', 'From your 10th price you count in full.'],
  ['Trusted local', 'Each time a neighbour confirms your price your standing rises. At 2.0 your prices count more than a stranger’s.'],
];

export function MePage() {
  return (
    <div className="mx-auto max-w-md space-y-6 pt-2">
      <section className="panel p-6 text-center">
        <h1 className="text-[22px] font-bold">Become a trusted local</h1>
        <p className="mt-2 text-[15px] text-muted">
          Checking prices never needs an account. Sign in to share what you paid, confirm or flag prices, and answer questions from newcomers.
        </p>
        <button type="button" className="btn-primary mt-5 w-full" disabled>
          <LogIn size={18} aria-hidden /> Sign in
        </button>
        <p className="mt-2 text-[13px] text-faint">Sign-in with Google or email is being switched on. Checking stays open to everyone.</p>
      </section>

      <section aria-labelledby="ladder">
        <h2 id="ladder" className="text-[16px] font-semibold">
          How standing works
        </h2>
        <ol className="mt-3 space-y-3">
          {LADDER.map(([t, d], i) => (
            <li key={t} className="panel flex items-start gap-4 p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[14px] font-bold text-white" aria-hidden>
                {i + 1}
              </span>
              <div>
                <p className="text-[15px] font-semibold">{t}</p>
                <p className="text-[14px] text-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <ul className="mt-4 space-y-1 text-[13px] text-faint">
          <li>Prices with a receipt count double. Receipts stay private to you.</li>
          <li>No shop names, ever. A price belongs to an item and an area, never a person.</li>
        </ul>
      </section>

      <p className="text-center text-[14px]">
        <Link href="/u/seed-u01" className="font-semibold text-accent-ink hover:underline">
          See what a trusted local’s profile looks like
        </Link>
      </p>
    </div>
  );
}

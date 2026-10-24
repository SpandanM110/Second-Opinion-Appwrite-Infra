import Link from 'next/link';
import { LogIn, ShieldCheck, Users, Receipt } from 'lucide-react';

export function MePage() {
  return (
    <div className="mx-auto max-w-md space-y-5 pt-4">
      <section className="panel p-6 text-center">
        <h1 className="text-[22px] font-bold">Become a trusted local</h1>
        <p className="mt-2 text-[15px] text-muted">Checking prices never needs an account. Sign in to log what you paid, confirm or flag numbers, and answer Quote Checks.</p>
        <button type="button" className="btn-primary mt-5 w-full" disabled>
          <LogIn size={18} aria-hidden /> Sign in with GitHub
        </button>
        <p className="mt-2 text-[13px] text-faint">Sign-in is being switched on.</p>
      </section>
      <ul className="space-y-3 text-[14px] text-muted">
        <li className="flex gap-3">
          <ShieldCheck size={20} className="shrink-0 text-accent-ink" aria-hidden /> Your reputation grows each time a neighbour confirms your price.
        </li>
        <li className="flex gap-3">
          <Receipt size={20} className="shrink-0 text-accent-ink" aria-hidden /> Logs with a receipt count double. Receipts stay private to you.
        </li>
        <li className="flex gap-3">
          <Users size={20} className="shrink-0 text-accent-ink" aria-hidden /> No shop names, ever. Prices belong to an item and an area, not a person.
        </li>
      </ul>
      <p className="text-center text-[14px]">
        <Link href="/u/seed-u01" className="font-semibold text-accent-ink hover:underline">
          See what a trusted local’s profile looks like
        </Link>
      </p>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Circle, LogIn, LogOut, Pencil, PenLine } from 'lucide-react';
import { LogRow } from '../components/LogRow';
import { ListSkeleton } from '../components/States';
import { useAuth } from '../lib/auth';
import { friendlyAuthError } from '../lib/authErrors';
import { useContribute } from '../lib/contribute';
import { useOnChange } from '../lib/events';
import { fetchUserLogs, fetchUsers } from '../lib/queries';
import { useRefData } from '../lib/ref';
import { useToast } from '../lib/toast';
import { useAsync } from '../lib/useAsync';
import { Reputation } from './ProfilePage';

const LADDER = [
  ['Newcomer', 'Your first 10 prices count at half weight, so one account can’t move a range.'],
  ['Regular', 'From your 10th price you count in full.'],
  ['Trusted local', 'Each time a neighbour confirms your price your standing rises. At 2.0 your prices count more than a stranger’s.'],
];

export function MePage() {
  const auth = useAuth();
  return auth.status === 'in' && auth.profile ? <Dashboard /> : <SignedOut loading={auth.status === 'loading'} />;
}

function SignedOut({ loading }: { loading: boolean }) {
  const auth = useAuth();
  return (
    <div className="mx-auto max-w-md space-y-6 pt-2">
      <section className="panel p-6 text-center">
        <h1 className="text-[22px] font-bold">Become a trusted local</h1>
        <p className="mt-2 text-[15px] text-muted">
          Checking prices never needs an account. Sign in to share what you paid, confirm or flag prices, and answer questions from newcomers.
        </p>
        <button type="button" className="btn-primary mt-5 w-full" disabled={loading} onClick={() => void auth.require('default')}>
          <LogIn size={18} aria-hidden /> Sign in or create an account
        </button>
        <p className="mt-2 text-[13px] text-faint">Free, with just an email and a password.</p>
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

function Dashboard() {
  const auth = useAuth();
  const ref = useRefData();
  const toast = useToast();
  const contribute = useContribute();
  const profile = auth.profile!;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.display_name);
  const [cityId, setCityId] = useState(profile.home_city_id ?? '');
  const [busy, setBusy] = useState(false);

  const mine = useAsync(async () => {
    const logs = await fetchUserLogs(profile.$id, 50);
    return { logs, users: await fetchUsers([profile.$id]) };
  }, [profile.$id]);

  useOnChange(() => {
    mine.reload();
    void auth.refreshProfile();
  });

  const count = Math.max(profile.log_count, mine.data?.logs.length ?? 0);
  const steps = [
    { done: Boolean(profile.home_city_id), label: 'Set your home city', note: ref.city(profile.home_city_id)?.name },
    { done: count >= 1, label: 'Share your first price', action: count >= 1 ? undefined : () => void contribute.openLog() },
    { done: count >= 10, label: 'Share 10 prices, then you count in full', progress: Math.min(count, 10) / 10, note: `${Math.min(count, 10)} of 10` },
    { done: profile.confirmations_received >= 1, label: 'Get your first confirmation from a neighbour' },
    { done: profile.reputation >= 2, label: 'Reach standing 2.0: a trusted local', progress: Math.min(Math.max(profile.reputation - 1, 0), 1), note: profile.reputation.toFixed(1) },
  ];
  const next = steps.find((s) => !s.done);

  const save = async () => {
    setBusy(true);
    try {
      await auth.updateProfile({ display_name: name, ...(cityId ? { home_city_id: cityId } : {}) });
      toast('Profile updated.');
      setEditing(false);
    } catch (e) {
      toast(friendlyAuthError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const field = 'tap w-full rounded-xl border border-line bg-surface px-3 text-[16px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/10';

  return (
    <div className="mx-auto max-w-2xl space-y-5 pt-2">
      <section className="panel p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[22px] font-bold text-accent-ink" aria-hidden>
            {profile.display_name.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[22px] font-bold">{profile.display_name}</h1>
            <p className="text-[14px] text-muted">
              {ref.city(profile.home_city_id)?.name ?? 'No home city yet'} · {auth.user?.email}
            </p>
          </div>
          <button type="button" onClick={() => setEditing((e) => !e)} className="tap inline-flex items-center justify-center rounded-xl text-muted hover:bg-canvas" aria-label="Edit profile" aria-expanded={editing}>
            <Pencil size={18} />
          </button>
        </div>

        {editing && (
          <form
            className="mt-4 space-y-3 border-t border-line pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="block">
              <span className="mb-1 block text-[13px] font-semibold text-muted">Name shown on your prices</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-semibold text-muted">Home city</span>
              <select value={cityId} onChange={(e) => setCityId(e.target.value)} className={field}>
                <option value="">Not set</option>
                {ref.cities.map((c) => (
                  <option key={c.$id} value={c.$id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}

        <Reputation user={{ ...profile, log_count: count }} />
      </section>

      <section className="panel p-5" aria-labelledby="journey">
        <div className="flex items-center justify-between gap-3">
          <h2 id="journey" className="text-[17px] font-semibold">
            Your journey
          </h2>
          <button type="button" className="btn-primary h-10 px-4 text-[14px]" onClick={() => void contribute.openLog()}>
            <PenLine size={16} aria-hidden /> Share a price
          </button>
        </div>
        {next && <p className="mt-1 text-[14px] text-muted">Next: {next.label.toLowerCase()}.</p>}
        <ol className="mt-3 space-y-2.5">
          {steps.map((s) => (
            <li key={s.label} className="flex items-start gap-3 text-[15px]">
              <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${s.done ? 'bg-high text-white' : 'border-2 border-line text-transparent'}`} aria-hidden>
                {s.done ? <Check size={13} strokeWidth={3} /> : <Circle size={1} />}
              </span>
              <span className={`min-w-0 flex-1 ${s.done ? 'text-muted' : 'font-medium'}`}>
                <span className="sr-only">{s.done ? 'Done: ' : 'To do: '}</span>
                {s.label}
                {s.note && <span className="num ml-2 text-[13px] text-faint">{s.note}</span>}
                {!s.done && s.progress !== undefined && (
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(4, s.progress * 100)}%` }} />
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel px-4" aria-labelledby="mine">
        <h2 id="mine" className="pt-4 text-[17px] font-semibold">
          Your prices
        </h2>
        {mine.status === 'loading' && !mine.data && <ListSkeleton rows={3} />}
        {mine.data && mine.data.logs.length === 0 && <p className="py-5 text-[14px] text-muted">Nothing yet. The next time you pay for something, add it here: it takes about 20 seconds.</p>}
        {mine.data && mine.data.logs.length > 0 && (
          <ul className="divide-y divide-line">
            {mine.data.logs.map((l) => (
              <LogRow key={l.$id} log={l} showItem author={mine.data!.users.get(l.user_id)} />
            ))}
          </ul>
        )}
      </section>

      <button type="button" onClick={() => void auth.signOut()} className="btn-secondary w-full">
        <LogOut size={18} aria-hidden /> Sign out
      </button>
    </div>
  );
}

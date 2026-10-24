'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppwriteException } from 'appwrite';
import { CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { account } from '../../lib/appwrite';

/** The page the "reset your password" email links to: /reset?userId=…&secret=… */
export function ResetForm() {
  const params = useSearchParams();
  const userId = params.get('userId');
  const secret = params.get('secret');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!userId || !secret) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-[24px] font-bold">That link isn’t complete</h1>
        <p className="mt-2 text-[15px] text-muted">Open the link from the email we sent, or ask for a new one from the sign-in screen.</p>
        <Link href="/me" className="btn-primary mt-5">
          Back to sign in
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center" role="status">
        <CheckCircle2 size={44} className="mx-auto text-high" aria-hidden />
        <h1 className="text-[24px] font-bold">Password updated</h1>
        <p className="text-[15px] text-muted">You can sign in with your new password.</p>
        <Link href="/me" className="btn-primary">
          Sign in
        </Link>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Use a password with at least 8 characters.');
    if (password !== again) return setError('The two passwords don’t match.');
    setBusy(true);
    try {
      await account.updateRecovery({ userId, secret, password });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof AppwriteException && (err.code === 401 || err.code === 404 || err.type === 'user_invalid_token')
          ? 'This link has expired or was already used. Ask for a new one from the sign-in screen.'
          : err instanceof AppwriteException && err.code
            ? 'Use a password with at least 8 characters, and try again.'
            : 'You seem to be offline. Check your connection and try again.',
      );
      setBusy(false);
    }
  };

  const input = 'tap w-full rounded-xl border border-line bg-surface px-3 text-[16px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/10';

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-md space-y-4 rounded-2xl border border-line bg-surface p-6">
      <h1 className="text-[24px] font-bold">Choose a new password</h1>
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-muted">New password (8 or more characters)</span>
        <span className="relative block">
          <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={`${input} pr-12`} />
          <button type="button" onClick={() => setShow((s) => !s)} className="tap absolute right-0 top-0 inline-flex items-center justify-center text-faint hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-muted">Type it again</span>
        <input type={show ? 'text' : 'password'} value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" className={input} />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
        {busy ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  );
}

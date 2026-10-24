'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, LogIn, MailCheck, UserPlus } from 'lucide-react';
import { cleanName } from '../core/rules.js';
import { friendlyAuthError, type AuthReason } from '../lib/authErrors';
import { usePlace } from '../lib/place';
import { useRefData } from '../lib/ref';
import { Sheet } from './Sheet';

const WHY: Record<AuthReason, string> = {
  paid: 'Share what you paid. It takes under 20 seconds and helps the next person.',
  ask: 'Ask locals if a quote is fair. Your question goes out with the current fair price attached.',
  confirm: 'Confirm prices you’ve paid too. It makes the range more trustworthy.',
  flag: 'Flag prices that look wrong. Three flags from different people hide a price.',
  reply: 'Answer a newcomer’s question with what you know.',
  helpful: 'Sign in to mark an answer helpful.',
  default: 'Share prices, confirm or flag them, and ask locals.',
};

interface Props {
  open: boolean;
  reason: AuthReason;
  onClose: () => void;
  onSignUp: (p: { name: string; email: string; password: string; homeCityId: string }) => Promise<void>;
  onSignIn: (p: { email: string; password: string }) => Promise<void>;
  onRecover: (email: string) => Promise<void>;
}

export function AuthSheet({ open, reason, onClose, onSignUp, onSignIn, onRecover }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Sign in to contribute">
      {open && <Form reason={reason} onSignUp={onSignUp} onSignIn={onSignIn} onRecover={onRecover} />}
    </Sheet>
  );
}

type Mode = 'signup' | 'signin' | 'forgot';

function Form({ reason, onSignUp, onSignIn, onRecover }: Omit<Props, 'open' | 'onClose'>) {
  const ref = useRefData();
  const place = usePlace();
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [cityId, setCityId] = useState(place.city?.$id ?? 'bhopal');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const uid = useId();
  const signup = mode === 'signup';
  const forgot = mode === 'forgot';

  useEffect(() => {
    const t = setTimeout(() => first.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [mode]);

  const go = (m: Mode) => {
    setMode(m);
    setError(null);
    setSent(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanedName = cleanName(name);
    if (signup && cleanedName.length < 2) return setError('Add a name neighbours will see, like “Arjun K.”');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Check your email address.');

    if (forgot) {
      setBusy(true);
      try {
        await onRecover(email.trim());
        setSent(true);
      } catch (err) {
        // The same answer whether or not the email has an account, so this can't be used to find out who has one.
        const msg = friendlyAuthError(err);
        if (/too many|offline/i.test(msg)) setError(msg);
        else setSent(true);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (password.length < 8) return setError('Use a password with at least 8 characters.');
    setBusy(true);
    try {
      if (signup) await onSignUp({ name: cleanedName, email: email.trim(), password, homeCityId: cityId });
      else await onSignIn({ email: email.trim(), password });
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  };

  const input = 'tap w-full rounded-xl border border-line bg-surface px-3 text-[16px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/10';

  if (forgot && sent) {
    return (
      <div className="space-y-4 pb-2 pt-2 text-center" role="status">
        <MailCheck size={44} className="mx-auto text-high" aria-hidden />
        <div>
          <h3 className="text-[20px] font-bold">Check your email</h3>
          <p className="mt-1 text-[15px] text-muted">If {email.trim()} has an account, a link to choose a new password is on its way. It can take a minute, and may land in spam.</p>
        </div>
        <button type="button" className="btn-secondary w-full" onClick={() => go('signin')}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <h3 className="text-[20px] font-bold">{signup ? 'Create your account' : forgot ? 'Reset your password' : 'Welcome back'}</h3>
        <p className="mt-1 text-[14px] text-muted">{forgot ? 'Enter the email you signed up with and we’ll send you a link.' : WHY[reason]}</p>
      </div>

      {signup && (
        <label className="block">
          <span className="mb-1 block text-[13px] font-semibold text-muted">Your name, as neighbours will see it</span>
          <input ref={first} id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Arjun K." autoComplete="name" maxLength={40} className={input} />
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-muted">Email</span>
        <input
          ref={signup ? undefined : first}
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          className={input}
        />
      </label>

      {!forgot && (
        <label className="block">
          <span className="mb-1 flex items-baseline justify-between text-[13px] font-semibold text-muted">
            <span>
              Password {signup && <span className="font-normal text-faint">(8 or more characters)</span>}
            </span>
            {!signup && (
              <button type="button" onClick={() => go('forgot')} className="tap -my-3 inline-flex items-center font-semibold text-accent-ink underline underline-offset-2">
                Forgot password?
              </button>
            )}
          </span>
          <span className="relative block">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signup ? 'new-password' : 'current-password'}
              className={`${input} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="tap absolute right-0 top-0 inline-flex items-center justify-center text-faint hover:text-ink"
              aria-label={showPw ? 'Hide password' : 'Show password'}
              aria-pressed={showPw}
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
      )}

      {signup && (
        <label className="block">
          <span className="mb-1 block text-[13px] font-semibold text-muted">Your home city</span>
          <select value={cityId} onChange={(e) => setCityId(e.target.value)} className={input}>
            {ref.cities.map((c) => (
              <option key={c.$id} value={c.$id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[12px] text-faint">Confirmations from people in a price’s own city count the most.</span>
        </label>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : signup ? <UserPlus size={18} aria-hidden /> : forgot ? <MailCheck size={18} aria-hidden /> : <LogIn size={18} aria-hidden />}
        {busy ? 'One moment…' : signup ? 'Create account' : forgot ? 'Send reset link' : 'Sign in'}
      </button>

      <p className="text-center text-[14px] text-muted">
        {forgot ? 'Remembered it?' : signup ? 'Already have an account?' : 'New here?'}{' '}
        <button type="button" onClick={() => go(signup ? 'signin' : forgot ? 'signin' : 'signup')} className="font-semibold text-accent-ink underline underline-offset-2">
          {signup || forgot ? 'Sign in' : 'Create an account'}
        </button>
      </p>
      <p className="pb-1 text-center text-[12px] text-faint">Your name is shown on the prices you share. We never show your email.</p>
    </form>
  );
}

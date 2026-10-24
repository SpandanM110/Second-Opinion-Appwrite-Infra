'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppwriteException, ID, type Models } from 'appwrite';
import { AuthSheet } from '../components/AuthSheet';
import { account, getRow } from './appwrite';
import { callWorker, warmWorker } from './api';
import type { AuthReason } from './authErrors';
import { announceChange } from './events';
import { flushOutbox, outboxCount } from './outbox';
import { load, save } from './storage';
import { useToast } from './toast';
import type { UserRow } from './types';

type User = Models.User<Models.Preferences>;

interface AuthApi {
  status: 'loading' | 'out' | 'in';
  user: User | null;
  profile: UserRow | null;
  /** Resolves true once the visitor is signed in (immediately if they already are); false if they dismiss the sheet. */
  require: (reason?: AuthReason) => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Emails a password-reset link. */
  recover: (email: string) => Promise<void>;
  updateProfile: (p: { display_name?: string; home_city_id?: string }) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);
// Whether this browser has a session. Lets signed-out visitors skip the network call (and its 401) entirely.
const FLAG = 'so.signedin';

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [status, setStatus] = useState<AuthApi['status']>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; reason: AuthReason }>({ open: false, reason: 'default' });
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const statusRef = useRef<AuthApi['status']>('loading');
  const ready = useRef<Promise<void>>(Promise.resolve());

  const setSignedIn = (u: User | null, p: UserRow | null) => {
    setUser(u);
    setProfile(p);
    const s = u ? 'in' : 'out';
    statusRef.current = s;
    setStatus(s);
    save(FLAG, Boolean(u));
  };

  const loadProfile = useCallback(async (u: User) => {
    try {
      return await getRow<UserRow>('users', u.$id);
    } catch (e) {
      if (e instanceof AppwriteException && e.code === 404) {
        await callWorker({ action: 'init' });
        return await getRow<UserRow>('users', u.$id);
      }
      throw e;
    }
  }, []);

  useEffect(() => {
    ready.current = (async () => {
      if (!load<boolean>(FLAG, false)) return setSignedIn(null, null);
      try {
        const u = await account.get();
        setSignedIn(u, await loadProfile(u).catch(() => null));
        warmWorker();
      } catch (e) {
        // A real "no session" (401) clears the flag; a flaky network keeps it for next time.
        if (e instanceof AppwriteException && e.code === 401) setSignedIn(null, null);
        else {
          statusRef.current = 'out';
          setStatus('out');
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prices saved while offline go out as soon as we're signed in and online.
  useEffect(() => {
    if (status !== 'in') return;
    const flush = async () => {
      if (!navigator.onLine || outboxCount() === 0) return;
      const { sent, rejected } = await flushOutbox();
      if (sent) {
        toast(sent === 1 ? 'Your saved price was sent.' : `${sent} saved prices were sent.`);
        announceChange();
      }
      rejected.forEach((m) => toast(m, 'error'));
    };
    void flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [status, toast]);

  const close = useCallback((ok: boolean) => {
    setSheet((s) => ({ ...s, open: false }));
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  const require = useCallback<AuthApi['require']>(async (reason = 'default') => {
    await ready.current;
    if (statusRef.current === 'in') return true;
    return new Promise<boolean>((resolve) => {
      resolver.current?.(false);
      resolver.current = resolve;
      setSheet({ open: true, reason });
    });
  }, []);

  const startSession = useCallback(
    async (email: string, password: string) => {
      try {
        await account.createEmailPasswordSession({ email, password });
      } catch (e) {
        // A stale session blocks a new one; clear it and retry once.
        if (e instanceof AppwriteException && e.type === 'user_session_already_exists') {
          await account.deleteSession({ sessionId: 'current' }).catch(() => {});
          await account.createEmailPasswordSession({ email, password });
        } else throw e;
      }
    },
    [],
  );

  const signUp = useCallback(
    async (p: { name: string; email: string; password: string; homeCityId: string }) => {
      await account.create({ userId: ID.unique(), email: p.email, password: p.password, name: p.name });
      await startSession(p.email, p.password);
      const u = await account.get();
      await callWorker({ action: 'init', home_city_id: p.homeCityId, display_name: p.name });
      setSignedIn(u, await loadProfile(u));
      toast(`Welcome, ${p.name.split(' ')[0]}.`);
      close(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startSession, loadProfile, toast, close],
  );

  const signIn = useCallback(
    async (p: { email: string; password: string }) => {
      await startSession(p.email, p.password);
      const u = await account.get();
      setSignedIn(u, await loadProfile(u));
      toast('Signed in.');
      close(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startSession, loadProfile, toast, close],
  );

  const recover = useCallback(async (email: string) => {
    await account.createRecovery({ email, url: `${window.location.origin}/reset` });
  }, []);

  const signOut = useCallback(async () => {
    await account.deleteSession({ sessionId: 'current' }).catch(() => {});
    setSignedIn(null, null);
    toast('Signed out.', 'info');
  }, [toast]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    setProfile(await loadProfile(user).catch(() => null));
  }, [user, loadProfile]);

  const updateProfile = useCallback<AuthApi['updateProfile']>(
    async (p) => {
      await callWorker({ action: 'profile', ...p });
      await refreshProfile();
    },
    [refreshProfile],
  );

  const api = useMemo<AuthApi>(() => ({ status, user, profile, require, signOut, recover, updateProfile, refreshProfile }), [status, user, profile, require, signOut, recover, updateProfile, refreshProfile]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <AuthSheet open={sheet.open} reason={sheet.reason} onClose={() => close(false)} onSignUp={signUp} onSignIn={signIn} onRecover={recover} />
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider missing');
  return v;
}

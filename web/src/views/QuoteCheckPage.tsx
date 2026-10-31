'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { Channel, Query } from 'appwrite';
import { MiniCard } from '../components/FairRangeCard';
import { Price } from '../components/Price';
import { parseCard } from '../components/QuoteCheckItem';
import { ErrorState, ListSkeleton } from '../components/States';
import { useAppBar } from '../lib/appbar';
import { callWorker } from '../lib/api';
import { client, DB, isNotFound } from '../lib/appwrite';
import { useAuth } from '../lib/auth';
import { friendlyAuthError } from '../lib/authErrors';
import { rupees, timeAgo, verdict } from '../lib/format';
import { fetchQuoteCheck, fetchReplies, fetchUsers } from '../lib/queries';
import { useRefData } from '../lib/ref';
import { useToast } from '../lib/toast';
import type { QuoteCheck, Reply, UserRow } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { NotFound } from './NotFound';

const TONE = { warn: 'bg-warn-soft text-warn', medium: 'bg-medium-soft text-medium', high: 'bg-high-soft text-high' } as const;

/** Server-rendered first paint; the client query still runs so the page is never stale. */
export interface QuestionInitial { qc: QuoteCheck; replies: Reply[]; users: UserRow[] }

export function QuoteCheckPage({ id, initial }: { id: string; initial?: QuestionInitial }) {
  const ref = useRefData();
  const auth = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [helpfulId, setHelpfulId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>(initial?.replies ?? []);
  const [users, setUsers] = useState<Map<string, UserRow>>(() => new Map((initial?.users ?? []).map((u) => [u.$id, u])));
  const [live, setLive] = useState(false);

  const q = useAsync(async () => {
    const [qc, rs] = await Promise.all([fetchQuoteCheck(id), fetchReplies(id)]);
    const us = await fetchUsers([qc.user_id, ...rs.map((r) => r.user_id)]);
    setReplies(rs);
    setUsers(us);
    return qc;
  }, [id], initial?.qc);

  const quoted = q.data?.quoted_price;
  useAppBar({ title: quoted !== undefined ? `Is ₹${rupees(quoted)} fair?` : 'Question', back: '/feed' }, [quoted]);

  // Replies stream in over Realtime, filtered server-side to this Quote Check.
  useEffect(() => {
    const unsubscribe = client.subscribe<Reply>(
      Channel.tablesdb(DB).table('replies').row().create(),
      async (event) => {
        const r = event.payload;
        if (r.quote_check_id !== id) return;
        const us = await fetchUsers([r.user_id]);
        setUsers((prev) => new Map([...prev, ...us]));
        setReplies((prev) => (prev.some((x) => x.$id === r.$id) ? prev : [...prev, r]));
      },
      [Query.equal('quote_check_id', id)],
    );
    setLive(true);
    const onVisible = () => document.visibilityState === 'visible' && q.reload();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubscribe();
      setLive(false);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (q.status === 'error' && !q.data) return isNotFound(q.error) ? <NotFound what="question" /> : <ErrorState message="Couldn’t load this question." onRetry={q.reload} />;
  const qc = q.data;
  if (!qc) return <ListSkeleton rows={5} />;

  const item = ref.item(qc.item_id);
  const locality = ref.locality(qc.locality_id);
  const city = ref.city(qc.city_id);
  const asker = users.get(qc.user_id);
  const card = parseCard(qc.attached_card);
  const v = card?.status === 'ok' ? verdict(qc.quoted_price, card.range) : null;
  const send = async () => {
    if (!(await auth.require('reply'))) return;
    setSending(true);
    try {
      await callWorker({ action: 'reply', quote_check_id: id, body: draft });
      setDraft('');
      toast('Answer posted.');
    } catch (e) {
      toast(friendlyAuthError(e), 'error');
    } finally {
      setSending(false);
    }
  };

  const markHelpful = async (replyId: string) => {
    try {
      await callWorker({ action: 'helpful', quote_check_id: id, reply_id: replyId });
      setHelpfulId(replyId);
      toast('Marked as helpful.');
    } catch (e) {
      toast(friendlyAuthError(e), 'error');
    }
  };

  const todayUrl = `/item/${qc.item_id}?c=${qc.city_id}${qc.locality_id ? `&l=${qc.locality_id}` : ''}`;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <article className="panel space-y-4 p-4 sm:p-6">
        <p className="text-[14px] text-faint">
          {item?.name} · {locality?.name ?? city?.name}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 aria-label={`Is ₹${rupees(qc.quoted_price)} fair?`} className="flex flex-wrap items-baseline gap-x-2 text-[22px] font-bold tracking-tight">
            Is <Price value={qc.quoted_price} size="lg" /> fair?
          </h1>
          {v && <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${TONE[v.tone]}`}>{v.text}</span>}
        </div>
        {qc.body && <p className="text-[17px] leading-relaxed">{qc.body}</p>}
        <p className="text-[13px] text-faint">
          Asked by{' '}
          {asker ? (
            <Link href={`/u/${asker.$id}`} className="font-medium text-muted hover:underline">
              {asker.display_name}
            </Link>
          ) : (
            'someone'
          )}{' '}
          · {timeAgo(qc.created_at)}
        </p>

        {card && (
          <div>
            <MiniCard card={card} title={card.status === 'ok' ? `Fair price when asked · ${card.scope.label}` : 'Fair price when asked'} marker={{ value: qc.quoted_price, label: 'quote' }} />
            <Link href={todayUrl} className="mt-2 inline-flex items-center gap-1 text-[14px] font-semibold text-accent-ink hover:underline">
              See today’s card <ExternalLink size={14} aria-hidden />
            </Link>
          </div>
        )}
      </article>

      <section aria-labelledby="replies" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="replies" className="text-[17px] font-semibold">
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'} from locals
          </h2>
          {live && (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-high" title="New replies appear instantly">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-high opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-high" />
              </span>
              Live
            </span>
          )}
        </div>
        <ul className="space-y-2" aria-live="polite">
          {replies.map((r) => {
            const u = users.get(r.user_id);
            const helpful = (helpfulId ?? qc.helpful_reply_id) === r.$id;
            return (
              <li key={r.$id} className={`panel p-4 ${helpful ? 'border-high/40 ring-1 ring-high/30' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent-ink" aria-hidden>
                    {(u?.display_name ?? '?').slice(0, 1)}
                  </span>
                  <p className="min-w-0 flex-1 text-[14px]">
                    {u ? (
                      <Link href={`/u/${u.$id}`} className="font-semibold hover:underline">
                        {u.display_name}
                      </Link>
                    ) : (
                      'A local'
                    )}
                    {u && u.reputation >= 2 && <span className="text-high"> · trusted local</span>}
                  </p>
                  <time className="text-[13px] text-faint" dateTime={r.created_at}>
                    {timeAgo(r.created_at)}
                  </time>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed">{r.body}</p>
                {!helpful && auth.user?.$id === qc.user_id && (
                  <button type="button" onClick={() => markHelpful(r.$id)} className="tap -ml-2 mt-1 inline-flex items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-accent-ink hover:bg-accent-soft">
                    <CheckCircle2 size={15} aria-hidden /> This helped
                  </button>
                )}
                {helpful && (
                  <p className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-high">
                    <CheckCircle2 size={15} aria-hidden /> Marked helpful by {asker?.display_name ?? 'the asker'}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="panel space-y-2 p-3"
        >
          <label htmlFor="reply" className="text-[13px] font-semibold text-muted">
            Your answer
          </label>
          <textarea
            id="reply"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="What did you pay for this? Anything that helps…"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[16px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="num text-[12px] text-faint">{draft.length}/500</span>
            <button type="submit" className="btn-primary h-11" disabled={sending || draft.trim().length < 2}>
              {auth.status === 'in' ? (sending ? 'Posting…' : 'Post answer') : 'Sign in to answer'}
            </button>
          </div>
        </form>
      </section>

    </div>
  );
}

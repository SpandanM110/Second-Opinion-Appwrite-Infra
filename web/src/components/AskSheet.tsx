'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { UNIT_LABEL } from '../core/card.js';
import { checkPrice, LIMITS } from '../core/rules.js';
import { callWorker } from '../lib/api';
import { friendlyAuthError } from '../lib/authErrors';
import { announceChange } from '../lib/events';
import { rupees, verdict } from '../lib/format';
import { usePlace } from '../lib/place';
import { fetchCard } from '../lib/queries';
import { useRefData } from '../lib/ref';
import { useToast } from '../lib/toast';
import { useAsync } from '../lib/useAsync';
import { band } from './Price';
import { PlaceChip } from './PlacePicker';
import { Sheet } from './Sheet';

const TONE = { warn: 'bg-warn-soft text-warn', medium: 'bg-medium-soft text-medium', high: 'bg-high-soft text-high' } as const;

export function AskSheet({ open, itemId, onClose }: { open: boolean; itemId?: string; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Ask locals">
      {open && <AskForm initialItemId={itemId} onClose={onClose} />}
    </Sheet>
  );
}

function AskForm({ initialItemId, onClose }: { initialItemId?: string; onClose: () => void }) {
  const ref = useRefData();
  const place = usePlace();
  const router = useRouter();
  const toast = useToast();
  const [itemId, setItemId] = useState(initialItemId ?? 'auto-per-km');
  const [price, setPrice] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const item = ref.item(itemId);
  const n = Number(price);
  const sane = item && price ? checkPrice(item, n) : null;
  const cityId = place.city?.$id;
  const localityId = place.locality?.$id;

  // The fair price that will be attached, shown live so the asker sees where their quote lands.
  const cardQ = useAsync(
    () => (item && place.city ? fetchCard(item, ref.categoryOf(item), place.city, place.locality) : Promise.reject(new Error('not ready'))),
    [itemId, cityId, localityId],
  );
  const card = cardQ.data?.card;
  const v = useMemo(() => (card?.status === 'ok' && price && sane?.ok ? verdict(n, card.range) : null), [card, price, sane, n]);

  const submit = async () => {
    setError(null);
    if (!item || !place.city) return setError('Pick the item and where it happened.');
    const s = checkPrice(item, n);
    if (!s.ok) return setError(s.message);
    setBusy(true);
    try {
      const r = await callWorker<{ id: string }>({ action: 'ask', item_id: itemId, city_id: place.city.$id, locality_id: place.locality?.$id ?? null, quoted_price: n, body: text.trim() || undefined, lat: place.coords?.lat, lng: place.coords?.lng });
      announceChange();
      toast('Question posted. Locals can answer now.');
      onClose();
      router.push(`/q/${r.id}`);
    } catch (e) {
      setError(friendlyAuthError(e));
      setBusy(false);
    }
  };

  const field = 'tap w-full rounded-xl border border-line bg-surface px-3 text-[16px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/10';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-4"
      noValidate
    >
      <p className="text-[14px] text-muted">Got a quote that feels off? Locals who’ve paid this will tell you. Your question goes out with the current fair price attached.</p>

      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-muted">What were you quoted for?</span>
        <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={field}>
          {ref.categories.map((cat) => (
            <optgroup key={cat.$id} label={cat.name}>
              {ref.items
                .filter((i) => i.category_id === cat.$id)
                .map((i) => (
                  <option key={i.$id} value={i.$id}>
                    {i.name} ({UNIT_LABEL[i.unit]})
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div>
        <span className="mb-1 block text-[13px] font-semibold text-muted">Where?</span>
        <PlaceChip />
      </div>

      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-muted">The quote {item && <span className="font-normal text-faint">({UNIT_LABEL[item.unit]})</span>}</span>
        <span className="relative block">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-faint" aria-hidden>
            ₹
          </span>
          <input
            inputMode="numeric"
            autoComplete="off"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-invalid={sane ? !sane.ok : undefined}
            className={`num h-14 w-full rounded-xl border bg-surface pl-10 pr-3 text-[28px] font-semibold outline-none focus:ring-4 ${sane && !sane.ok ? 'border-warn focus:ring-warn/10' : 'border-line focus:border-accent focus:ring-accent/10'}`}
          />
        </span>
        <span className="mt-1 block min-h-5 text-[13px] text-warn" role="status">
          {sane && !sane.ok ? sane.message : ''}
        </span>
      </label>

      <div className="min-h-[52px] rounded-xl bg-canvas px-3 py-2.5 text-[14px]" aria-live="polite">
        {card?.status === 'ok' ? (
          <>
            <span className="text-muted">Fair price now: </span>
            <span className="num font-semibold">{band(card.range.p25, card.range.p75)}</span>
            <span className="text-muted"> · {card.confidence.level} confidence · {card.scope.label}</span>
            {v && (
              <span className={`mt-2 block rounded-lg px-2.5 py-1.5 font-medium ${TONE[v.tone]}`}>
                ₹{rupees(n)} is {v.text}
              </span>
            )}
          </>
        ) : card?.status === 'no_data' ? (
          <span className="text-muted">No fair price here yet. Your question will help start one.</span>
        ) : (
          <span className="text-faint">Looking up the fair price…</span>
        )}
      </div>

      <label className="block">
        <span className="mb-1 flex justify-between text-[13px] font-semibold text-muted">
          <span>
            Anything locals should know? <span className="font-normal text-faint">(optional)</span>
          </span>
          <span className="num font-normal text-faint">
            {text.length}/{LIMITS.askMax}
          </span>
        </span>
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, LIMITS.askMax))} rows={3} placeholder="From the station to MP Nagar, two bags, quoted at the gate…" className={`${field} py-2`} />
        <span className="mt-1 block text-[12px] text-faint">Please don’t write shop or driver names.</span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={busy || !price || Boolean(sane && !sane.ok)}>
        {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
        {busy ? 'Posting…' : 'Ask locals'}
      </button>
    </form>
  );
}

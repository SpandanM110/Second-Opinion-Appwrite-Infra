'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2, Loader2, X } from 'lucide-react';
import { ID, Permission, Role } from 'appwrite';
import { UNIT_LABEL } from '../core/card.js';
import { checkPrice, LIMITS } from '../core/rules.js';
import { ApiError, callWorker } from '../lib/api';
import { RECEIPTS_BUCKET, storage } from '../lib/appwrite';
import { useAuth } from '../lib/auth';
import { friendlyAuthError } from '../lib/authErrors';
import { announceChange } from '../lib/events';
import { prepareReceipt } from '../lib/image';
import { enqueue } from '../lib/outbox';
import { usePlace } from '../lib/place';
import { useRefData } from '../lib/ref';
import { load, save } from '../lib/storage';
import type { PriceType } from '../lib/types';
import { PriceTypeHelp } from './LogRow';
import { PlaceChip } from './PlacePicker';
import { Sheet } from './Sheet';

const DRAFT = 'so.draft.log.v1';
const TYPES: { key: PriceType; label: string; help: string }[] = [
  { key: 'paid', label: 'I paid', help: 'What you actually handed over. This is what builds the fair price.' },
  { key: 'quoted', label: 'I was quoted', help: 'What you were asked first, before bargaining. It shows how much sellers inflate, but doesn’t set the fair price.' },
  { key: 'listed', label: 'On a board', help: 'A price on a menu or rate card. It counts towards the fair price.' },
];

export function LogSheet({ open, itemId, onClose }: { open: boolean; itemId?: string; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Share a price">
      {open && <LogForm initialItemId={itemId} onClose={onClose} />}
    </Sheet>
  );
}

function LogForm({ initialItemId, onClose }: { initialItemId?: string; onClose: () => void }) {
  const ref = useRefData();
  const place = usePlace();
  const auth = useAuth();
  const router = useRouter();
  const priceRef = useRef<HTMLInputElement>(null);
  const clientRef = useRef(crypto.randomUUID());
  const draft = load<{ itemId: string; price: string; type: PriceType; note: string } | null>(DRAFT, null);
  const resume = draft && (!initialItemId || draft.itemId === initialItemId) ? draft : null;

  const [itemId, setItemId] = useState(initialItemId ?? resume?.itemId ?? 'auto-per-km');
  const [price, setPrice] = useState(resume?.price ?? '');
  const [type, setType] = useState<PriceType>(resume?.type ?? 'paid');
  const [note, setNote] = useState(resume?.note ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'saving'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<null | { left?: number } | 'queued'>(null);

  const item = ref.item(itemId);
  const n = Number(price);
  const sane = item && price ? checkPrice(item, n) : null;
  const busy = phase !== 'idle';

  useEffect(() => {
    const t = setTimeout(() => priceRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (saved) return;
    save(DRAFT, price || note ? { itemId, price, type, note } : null);
  }, [itemId, price, type, note, saved]);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const body = () => {
    const loc = place.locality;
    const here = place.source === 'gps' && place.coords ? place.coords : loc ? { lat: loc.lat, lng: loc.lng } : place.city ? { lat: place.city.lat, lng: place.city.lng } : null;
    return {
      action: 'log',
      client_ref: clientRef.current,
      item_id: itemId,
      city_id: place.city?.$id,
      locality_id: loc?.$id ?? null,
      price: n,
      price_type: type,
      note: note.trim() || undefined,
      lat: here?.lat,
      lng: here?.lng,
    };
  };

  const submit = async () => {
    setError(null);
    if (!item || !place.city) return setError('Pick what you paid for and where.');
    const s = checkPrice(item, n);
    if (!s.ok) return setError(s.message);

    const payload: Record<string, unknown> = body();
    try {
      if (file) {
        setPhase('uploading');
        try {
          const ready = await prepareReceipt(file);
          const up = await storage.createFile({ bucketId: RECEIPTS_BUCKET, fileId: ID.unique(), file: ready, permissions: [Permission.read(Role.user(auth.user!.$id))] });
          payload.proof_file_id = up.$id;
        } catch (e) {
          setPhase('idle');
          return setError(e instanceof Error && !('code' in e) ? e.message : 'We couldn’t upload the receipt photo. Try again, or remove it to save the price without it.');
        }
      }
      setPhase('saving');
      const r = await callWorker<{ left?: number }>(payload);
      save(DRAFT, null);
      setSaved({ left: r.left });
      announceChange();
      router.refresh();
      setTimeout(announceChange, 7000); // by now the fair range has been recomputed
    } catch (e) {
      if (e instanceof ApiError && e.retryable) {
        if (file) setError('You’re offline, and a receipt photo can’t upload without a connection. Remove the photo to save the price on this phone and send it later.');
        else {
          enqueue(payload);
          save(DRAFT, null);
          setSaved('queued');
        }
      } else setError(friendlyAuthError(e));
    } finally {
      setPhase('idle');
    }
  };

  if (saved) {
    return (
      <div className="space-y-4 pb-2 pt-2 text-center" role="status">
        <CheckCircle2 size={44} className="mx-auto text-high" aria-hidden />
        <div>
          <h3 className="text-[20px] font-bold">{saved === 'queued' ? 'Saved on this phone' : 'Thank you. Your price is in.'}</h3>
          <p className="mt-1 text-[15px] text-muted">
            {saved === 'queued'
              ? 'You’re offline. We’ll send it as soon as you’re back online.'
              : 'It helps the next person. The fair price updates in a few seconds.'}
          </p>
          {saved !== 'queued' && typeof saved.left === 'number' && saved.left <= 5 && <p className="mt-1 text-[13px] text-faint">{saved.left} more prices today.</p>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => {
              clientRef.current = crypto.randomUUID();
              setSaved(null);
              setPrice('');
              setNote('');
              setFile(null);
              setType('paid');
              setTimeout(() => priceRef.current?.focus(), 50);
            }}
          >
            Share another
          </button>
          <button type="button" className="btn-primary flex-1" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    );
  }

  const field = 'tap w-full rounded-xl border border-line bg-surface px-3 text-[16px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/10';
  const typeHelp = TYPES.find((t) => t.key === type)!.help;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-4"
      noValidate
    >
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-muted">What did you pay for?</span>
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
        <p className="mt-1 text-[12px] text-faint">{place.locality ? 'Pick a different area if this isn’t where it happened.' : 'Pick the area for a more useful price.'}</p>
      </div>

      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-muted">
          Price {item && <span className="font-normal text-faint">({UNIT_LABEL[item.unit]})</span>}
        </span>
        <span className="relative block">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-faint" aria-hidden>
            ₹
          </span>
          <input
            ref={priceRef}
            inputMode="numeric"
            autoComplete="off"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-invalid={sane ? !sane.ok : undefined}
            aria-describedby="price-help"
            className={`num h-14 w-full rounded-xl border bg-surface pl-10 pr-3 text-[28px] font-semibold outline-none focus:ring-4 ${sane && !sane.ok ? 'border-warn focus:ring-warn/10' : 'border-line focus:border-accent focus:ring-accent/10'}`}
          />
        </span>
        <span id="price-help" className="mt-1 block min-h-5 text-[13px] text-warn" role="status">
          {sane && !sane.ok ? sane.message : ''}
        </span>
      </label>

      <fieldset>
        <legend className="mb-1 text-[13px] font-semibold text-muted">What kind of price is it?</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={type === t.key}
              onClick={() => setType(t.key)}
              className={`tap rounded-xl border px-1 text-[14px] font-semibold ${type === t.key ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line hover:bg-canvas'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-muted">{typeHelp}</p>
        {resume === null && !draft && <div className="mt-1"><PriceTypeHelp /></div>}
      </fieldset>

      <div>
        <span className="mb-1 block text-[13px] font-semibold text-muted">
          Receipt photo <span className="font-normal text-faint">(optional)</span>
        </span>
        {file && preview ? (
          <div className="flex items-center gap-3 rounded-xl border border-line p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your receipt" className="size-14 rounded-lg object-cover" />
            <p className="min-w-0 flex-1 truncate text-[14px]">{file.name}</p>
            <button type="button" onClick={() => setFile(null)} className="tap inline-flex items-center justify-center rounded-full text-muted hover:bg-canvas" aria-label="Remove the receipt photo">
              <X size={18} />
            </button>
          </div>
        ) : (
          <label className="tap flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line px-3 text-[14px] font-medium text-accent-ink hover:bg-accent-soft">
            <Camera size={18} aria-hidden /> Add a photo
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        )}
        <p className="mt-1 text-[12px] text-faint">A receipt makes your price count double. Receipts stay private to you.</p>
      </div>

      <label className="block">
        <span className="mb-1 flex justify-between text-[13px] font-semibold text-muted">
          <span>
            Note <span className="font-normal text-faint">(optional)</span>
          </span>
          <span className="num font-normal text-faint">
            {note.length}/{LIMITS.noteMax}
          </span>
        </span>
        <input value={note} onChange={(e) => setNote(e.target.value.slice(0, LIMITS.noteMax))} placeholder="After bargaining, at night, with luggage…" className={field} />
        <span className="mt-1 block text-[12px] text-faint">Please don’t write shop or driver names. Prices belong to an item and an area.</span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-warn-soft px-3 py-2.5 text-[14px] text-warn">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={busy || !price || Boolean(sane && !sane.ok)}>
        {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
        {phase === 'uploading' ? 'Uploading receipt…' : phase === 'saving' ? 'Saving…' : 'Save price'}
      </button>
    </form>
  );
}

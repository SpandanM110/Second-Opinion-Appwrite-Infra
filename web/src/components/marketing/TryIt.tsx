'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, Loader2, Play } from 'lucide-react';
import { FAIR_RANGE_URL } from '../../lib/appwrite';
import { useRefData } from '../../lib/ref';

/** A live request to the public endpoint, so the reference proves itself. */
export function TryIt() {
  const ref = useRefData();
  const [item, setItem] = useState('auto-station-to-centre');
  const [cityId, setCityId] = useState('bhopal');
  const [localityId, setLocalityId] = useState('bpl-rani-kamlapati-station');
  const [state, setState] = useState<{ status: number; ms: number; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const localities = useMemo(() => ref.localitiesIn(cityId), [ref, cityId]);
  const url = `${FAIR_RANGE_URL}/?item=${item}${localityId ? `&locality=${localityId}` : `&city=${cityId}`}`;

  const send = async () => {
    setBusy(true);
    setState(null); // never leave the previous answer on screen while the next one loads
    const t0 = performance.now();
    try {
      const res = await fetch(url);
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* show as-is */
      }
      setState({ status: res.status, ms: Math.round(performance.now() - t0), body: pretty });
    } catch {
      setState({ status: 0, ms: Math.round(performance.now() - t0), body: 'Network error. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  };

  const field = 'tap w-full rounded-xl border border-panel-ink/20 bg-panel-ink/10 px-3 text-[15px] text-panel-ink outline-none focus:border-panel-ink/60';

  return (
    <div className="rounded-2xl border border-line bg-panel p-4 text-panel-ink sm:p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-panel-ink/70">item</span>
          <select value={item} onChange={(e) => setItem(e.target.value)} className={field}>
            {ref.items.map((i) => (
              <option key={i.$id} value={i.$id} className="text-ink">
                {i.slug}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-panel-ink/70">city</span>
          <select
            value={cityId}
            onChange={(e) => {
              setCityId(e.target.value);
              setLocalityId('');
            }}
            className={field}
          >
            {ref.cities.map((c) => (
              <option key={c.$id} value={c.$id} className="text-ink">
                {c.$id}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-panel-ink/70">locality (optional)</span>
          <select value={localityId} onChange={(e) => setLocalityId(e.target.value)} className={field}>
            <option value="" className="text-ink">
              none: city-wide
            </option>
            {localities.map((l) => (
              <option key={l.$id} value={l.$id} className="text-ink">
                {l.$id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex items-stretch gap-2">
        <code tabIndex={0} className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-panel-ink/10 px-3 py-2.5 text-[12px]">curl &quot;{url}&quot;</code>
        <button
          type="button"
          className="tap inline-flex items-center justify-center rounded-lg bg-panel-ink/10 hover:bg-panel-ink/20"
          aria-label="Copy the curl command"
          onClick={() => {
            navigator.clipboard?.writeText(`curl "${url}"`).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
        <button type="button" onClick={send} disabled={busy} className="btn bg-panel-ink text-panel hover:bg-panel-ink/85">
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} aria-hidden />} Send
        </button>
      </div>

      <div className="mt-4 min-h-24" aria-live="polite">
        {state && (
          <>
            <p className="mb-2 text-[13px] text-panel-ink/75">
              <span className={`mr-2 rounded px-1.5 py-0.5 font-mono text-[12px] ${state.status === 200 ? 'bg-high-solid text-white' : 'bg-warn-solid text-white'}`}>{state.status || 'ERR'}</span>
              {state.ms} ms
            </p>
            <pre tabIndex={0} className="max-h-96 overflow-auto rounded-xl bg-panel-ink/10 p-4 text-[12px] leading-relaxed">
              <code>{state.body}</code>
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

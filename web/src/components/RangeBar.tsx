import { rupees } from '../lib/format';

interface Props {
  p10: number; p25: number; median: number; p75: number; p90: number;
  marker?: { value: number; label: string };
  compact?: boolean;
}

/**
 * The fair range drawn to scale: whiskers p10–p90, band p25–p75, tick at the median.
 * An optional marker (e.g. a quoted price) is clamped to the edge with an arrow when off-scale.
 */
export function RangeBar({ p10, p25, median, p75, p90, marker, compact = false }: Props) {
  const lo = Math.min(p10, p25);
  const hi = Math.max(p90, p75);
  const pad = Math.max((hi - lo) * 0.12, median * 0.04, 1);
  const min = lo - pad;
  const max = hi + pad;
  const pct = (v: number) => `${(((v - min) / (max - min)) * 100).toFixed(2)}%`;
  const offScale = marker ? (marker.value > max ? 'right' : marker.value < min ? 'left' : null) : null;
  const markerPos = marker ? (offScale === 'right' ? '100%' : offScale === 'left' ? '0%' : pct(marker.value)) : '0%';

  return (
    <figure className={compact ? '' : 'pt-1'} aria-label={`Range: 10% paid under ₹${rupees(p10)}, half paid between ₹${rupees(p25)} and ₹${rupees(p75)}, 10% paid over ₹${rupees(p90)}.`}>
      <div className={`relative ${compact ? 'h-5' : 'h-7'}`} aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
        <div className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#cbd5e1]" style={{ left: pct(p10), right: `calc(100% - ${pct(p90)})` }} />
        <div className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-[#94a3b8] ${compact ? 'h-2.5' : 'h-3.5'}`} style={{ left: pct(p25), right: `calc(100% - ${pct(p75)})` }} />
        <div className={`absolute top-1/2 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ${compact ? 'h-4' : 'h-6'}`} style={{ left: pct(median) }} />
        {marker && (
          <div className="absolute top-1/2 -translate-y-1/2" style={{ left: markerPos }}>
            <div className={`-translate-x-1/2 rounded-full border-2 border-white bg-warn shadow ${compact ? 'size-3' : 'size-4'}`} />
          </div>
        )}
      </div>
      {!compact && (
        <figcaption className="num mt-1 flex justify-between text-[12px] text-faint" aria-hidden>
          <span>₹{rupees(p10)}</span>
          {marker ? (
            <span className="font-semibold text-warn">
              {offScale === 'right' ? `${marker.label} ₹${rupees(marker.value)} →` : offScale === 'left' ? `← ${marker.label} ₹${rupees(marker.value)}` : `${marker.label} ₹${rupees(marker.value)}`}
            </span>
          ) : (
            <span>half paid in the dark band</span>
          )}
          <span>₹{rupees(p90)}</span>
        </figcaption>
      )}
    </figure>
  );
}

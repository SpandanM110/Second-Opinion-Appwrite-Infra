const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const rtf = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });

export const rupees = (n: number) => inr.format(Math.round(n));

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86_400 * 30) return rtf.format(Math.round(s / 86_400), 'day');
  return rtf.format(Math.round(s / (86_400 * 30)), 'month');
}

export const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

export function ratioLine(a: number, b: number, nameA: string, nameB: string) {
  const r = b / a;
  if (r > 0.9 && r < 1.1) return `${nameB} and ${nameA} are about the same`;
  return r >= 1 ? `${nameB} is ${r.toFixed(1)}x ${nameA}` : `${nameA} is ${(1 / r).toFixed(1)}x ${nameB}`;
}

/** Where a quoted price sits against a fair range. */
export function verdict(quoted: number, r: { p25: number; p75: number; p90: number; median: number }) {
  if (quoted > r.p90) return { tone: 'warn' as const, text: `${(quoted / r.median).toFixed(1)}x the usual price` };
  if (quoted > r.p75) return { tone: 'medium' as const, text: 'above what most people paid' };
  if (quoted < r.p25) return { tone: 'high' as const, text: 'below the usual range' };
  return { tone: 'high' as const, text: 'within the fair range' };
}

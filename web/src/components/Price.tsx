import { rupees } from '../lib/format';

const SIZES = {
  hero: { num: 'text-[44px] leading-none font-bold tracking-tight', sym: 'text-[26px] font-semibold mr-0.5' },
  lg: { num: 'text-[28px] leading-none font-bold tracking-tight', sym: 'text-[18px] font-semibold mr-0.5' },
  md: { num: 'text-[17px] font-semibold', sym: 'text-[13px] font-medium mr-px' },
  sm: { num: 'text-[15px] font-semibold', sym: 'text-[12px] font-medium mr-px' },
};

/** Prices: tabular digits, the ₹ smaller than the number (plan: visual language). */
export function Price({ value, size = 'md', className = '' }: { value: number; size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  return (
    <span className={`num inline-flex items-baseline ${className}`}>
      <span className={s.sym}>₹</span>
      <span className={s.num}>{rupees(value)}</span>
    </span>
  );
}

export const band = (a: number, b: number) => (a === b ? `₹${rupees(a)}` : `₹${rupees(a)}–${rupees(b)}`);

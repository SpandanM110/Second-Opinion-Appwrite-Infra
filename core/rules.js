// Input rules shared by the web app (instant feedback) and the `submit` Function (the actual enforcement).
// Never trust the browser: the Function re-checks everything here before writing a row.

import { UNIT_LABEL } from './card.js';

export const LIMITS = {
  noteMax: 140,
  askMax: 300,
  replyMax: 500,
  nameMin: 2,
  nameMax: 40,
  pricesPerDay: 20,
  flagsToHide: 3,
};

export const PRICE_TYPES = ['paid', 'quoted', 'listed'];
export const FLAG_REASONS = ['typo', 'wrong_unit', 'tourist_price', 'vendor_posting', 'other'];

export const FLAG_REASON_LABEL = {
  typo: 'A typo',
  wrong_unit: 'Wrong unit (for example per kg instead of per plate)',
  tourist_price: 'A tourist or newcomer price',
  vendor_posting: 'Posted by the seller',
  other: 'Something else',
};

/** Strip control characters, collapse whitespace and cap the length. */
export function cleanText(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** A public display name: letters, digits, spaces and a few separators. "Arjun K." not "arjun@mail.com". */
export function cleanName(value) {
  return cleanText(value, LIMITS.nameMax * 2)
    .replace(/[^\p{L}\p{M}\p{N} .'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LIMITS.nameMax);
}

/**
 * Typo guard from the item's sanity bounds. Bounds only reject obvious mistakes (₹50,000 for an auto ride);
 * they never feed the statistics.
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function checkPrice(item, price) {
  if (!Number.isFinite(price) || !Number.isInteger(price) || price < 1) {
    return { ok: false, code: 'bad_price', message: 'Enter the price as a whole number of rupees, like 100.' };
  }
  const unit = UNIT_LABEL[item.unit] ?? '';
  const max = Number(item.typical_max) || 0;
  const min = Number(item.typical_min) || 0;
  if (max && price > max) {
    const times = Math.max(2, Math.round(price / max));
    return {
      ok: false,
      code: 'too_high',
      message: `₹${price} is about ${times}x the highest price we’d expect for ${item.name.toLowerCase()} (around ₹${max}). Double-check the amount and the unit (${unit}).`,
    };
  }
  if (min && price < min) {
    return {
      ok: false,
      code: 'too_low',
      message: `₹${price} is lower than we’d expect for ${item.name.toLowerCase()} (usually ₹${min} or more). Double-check the amount and the unit (${unit}).`,
    };
  }
  return { ok: true };
}

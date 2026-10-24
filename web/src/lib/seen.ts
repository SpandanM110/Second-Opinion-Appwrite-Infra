// "Has this visitor met the product yet?" A cookie (not localStorage) so the server can decide at `/`
// whether to show the landing page or send a returning visitor straight to the tool.

export const SEEN_COOKIE = 'so_seen';

export function markSeen() {
  if (typeof document === 'undefined') return;
  document.cookie = `${SEEN_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
}

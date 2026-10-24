export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#3730a3" />
      <rect x="5" y="14" width="22" height="4" rx="2" fill="#818cf8" />
      <rect x="10" y="12.5" width="12" height="7" rx="3.5" fill="#c7d2fe" />
      <rect x="15" y="8" width="2.5" height="16" rx="1.25" fill="#fff" />
    </svg>
  );
}

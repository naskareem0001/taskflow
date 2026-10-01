import type { Option } from "@/lib/types";

/**
 * Small round badge for a project category: its colour plus a symbol picked
 * from the category's name, so two projects for the same brand are easy to
 * tell apart at a glance. Unrecognised names get a generic tag symbol.
 */
const SYMBOLS: { match: RegExp; path: React.ReactNode }[] = [
  {
    // Video / motion: a screen with a play triangle.
    match: /video|motion|film|anim/i,
    path: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m10 9 5 3-5 3z" fill="currentColor" />
      </>
    ),
  },
  {
    // Brand identity: a gem.
    match: /brand|identity|logo/i,
    path: (
      <>
        <path d="M6 3h12l4 6-10 12L2 9z" />
        <path d="M2 9h20M12 21 8 9l4-6 4 6z" />
      </>
    ),
  },
  {
    // Web: a globe.
    match: /web|site|ui|ux/i,
    path: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </>
    ),
  },
  {
    // Digital design: a picture.
    match: /digital|social|graphic|design|print/i,
    path: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="9" cy="9" r="1.5" />
        <path d="m21 15-4.5-4.5L6 21" />
      </>
    ),
  },
];

const FALLBACK = (
  <>
    <path d="M4 4h7l9 9-7 7-9-9z" />
    <circle cx="8" cy="8" r="1" />
  </>
);

export function CategoryIcon({ category, size = 20 }: { category?: Option; size?: number }) {
  if (!category) return null;
  const symbol = SYMBOLS.find((s) => s.match.test(category.name))?.path ?? FALLBACK;
  return (
    <span
      title={category.name}
      className="inline-flex shrink-0 items-center justify-center rounded-full text-white ring-1 ring-white/50"
      style={{ width: size, height: size, background: category.color }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size * 0.6, height: size * 0.6 }}
        aria-hidden
      >
        {symbol}
      </svg>
    </span>
  );
}

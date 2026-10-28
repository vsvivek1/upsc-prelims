import Link from "next/link";

/** Algo UPSC mark: a stack of cards with a saffron spark (the next card the engine picks). */
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Algo UPSC home">
      <svg width={small ? 28 : 34} height={small ? 28 : 34} viewBox="0 0 64 64" aria-hidden>
        <rect x="10" y="16" width="38" height="40" rx="7" fill="#3a4170" />
        <rect x="16" y="9" width="38" height="40" rx="7" fill="#1c2140" />
        <path d="M27 37 L35 19 L43 37 M30 31 H40" stroke="#f6f1e7" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="52" cy="12" r="6" fill="#e07a1f" />
      </svg>
      {!small && <span className="font-display text-xl tracking-tight">Algo UPSC</span>}
    </Link>
  );
}

"use client";
import type { Lang } from "@/engine";
import { t } from "@/lib/i18n";
import { Logo } from "../Logo";

/** The only bar: quota ring, next sitting, streak, exam countdown and the profile button. */
export function FeedHeader(props: {
  lang: Lang;
  done: number;
  quota: number;
  minutesLeft: number;
  daysLeft: number;
  streak: number;
  nextLabel: string | null;
  onProfile: () => void;
}) {
  const L = t(props.lang);
  const frac = props.quota > 0 ? props.done / props.quota : 1;
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <header className="flex items-center gap-3 pb-2">
      <Logo small />
      <div className="flex items-center gap-2" title={`${L.today} ${props.done}/${props.quota}`}>
        <svg width="38" height="38" viewBox="0 0 38 38" className="-rotate-90" aria-hidden>
          <circle cx="19" cy="19" r={r} fill="none" strokeWidth="4" className="ring-track" />
          <circle cx="19" cy="19" r={r} fill="none" strokeWidth="4" className="ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} strokeLinecap="round" />
        </svg>
        <div className="leading-tight">
          <p className="text-sm font-semibold tabular-nums">
            {L.today} {L.quota(props.done, props.quota)}
          </p>
          <p className="text-xs text-muted">
            {props.quota > props.done ? L.minLeft(props.minutesLeft) : L.quotaComplete}
            {props.nextLabel ? ` · ${props.nextLabel}` : ""}
          </p>
        </div>
      </div>
      <div className="ml-auto hidden text-right text-xs leading-tight text-muted sm:block">
        {props.daysLeft >= 0 && <p>{L.daysToExam(props.daysLeft)}</p>}
        {props.streak > 0 && <p>🔥 {L.streak(props.streak)}</p>}
      </div>
      <button
        onClick={props.onProfile}
        className="ml-auto flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card sm:ml-0"
        aria-label={L.profile}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
      </button>
    </header>
  );
}

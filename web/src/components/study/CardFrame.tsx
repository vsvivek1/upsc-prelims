"use client";
import { useEffect, type ReactNode } from "react";
import type { Lang, Rating } from "@/engine";
import { t } from "@/lib/i18n";
import { speak, useSeenSeconds } from "./hooks";

export type Action =
  | { kind: "next"; label?: string }
  | { kind: "rate" }
  | { kind: "choices"; buttons: { label: string; tone?: "good" | "bad" | "plain"; onPick: () => void }[] }
  | { kind: "none" };

export interface Screen {
  key: string;
  body: ReactNode;
  min: number;
  action: Action;
  speak?: string;
  /** Extra button beside the main action (e.g. "Explain"). Always available. */
  side?: { label: string; onClick: () => void };
}

interface Props {
  screen: Screen;
  lang: Lang;
  initialSeconds?: number;
  progress: { pos: number; total: number };
  onNext: () => void;
  onRate: (r: Rating) => void;
  onToggleLang: () => void;
  onTick?: (secs: number) => void;
}

const RATING_STYLE = [
  "bg-rose-soft text-rose border-rose/30",
  "bg-saffron-soft text-saffron border-saffron/30",
  "bg-leaf-soft text-leaf border-leaf/30",
  "bg-ink text-paper border-ink",
];

/** Ring that fills while the minimum time runs. Quiet: no ticking numbers. */
export function TimeRing({ frac }: { frac: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden className="shrink-0 -rotate-90">
      <circle cx="12" cy="12" r={r} fill="none" strokeWidth="3" className="ring-track" />
      <circle cx="12" cy="12" r={r} fill="none" strokeWidth="3" className="ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} strokeLinecap="round" />
    </svg>
  );
}

export function CardFrame({ screen, lang, initialSeconds = 0, progress, onNext, onRate, onToggleLang, onTick }: Props) {
  const L = t(lang);
  const secs = useSeenSeconds(screen.key, initialSeconds);
  useEffect(() => {
    onTick?.(secs);
  }, [secs, onTick]);
  const frac = screen.min > 0 ? Math.min(1, secs / screen.min) : 1;
  const unlocked = frac >= 1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-1 pb-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-label={`${progress.pos} ${L.of} ${progress.total}`}>
          <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${(progress.pos / Math.max(progress.total, 1)) * 100}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted">
          {progress.pos}/{progress.total}
        </span>
        <button
          onClick={onToggleLang}
          className="rounded-full border border-line px-2 py-0.5 text-xs font-semibold text-ink-soft"
          aria-label="Switch language"
        >
          {lang === "en" ? "हिं" : "EN"}
        </button>
        {screen.speak && (
          <button onClick={() => speak(screen.speak!, lang)} className="rounded-full border border-line p-1 text-ink-soft" aria-label={L.audio} title={L.audio}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 10v4h4l5 4V6L8 10H4z" />
              <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
            </svg>
          </button>
        )}
      </div>

      <div key={screen.key} className={`fade-up flex-1 overflow-y-auto rounded-3xl border border-line bg-card p-5 shadow-sm sm:p-8 ${lang === "hi" ? "lang-hi" : ""}`}>
        {screen.body}
      </div>

      <div className="pt-3">
        {screen.action.kind === "rate" && (
          <div className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${unlocked ? "" : "opacity-40"}`}>
            {L.ratings.map((label, i) => (
              <button
                key={label}
                disabled={!unlocked}
                onClick={() => onRate((i + 1) as Rating)}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-base font-semibold transition ${RATING_STYLE[i]} ${unlocked ? "fade-up active:scale-[0.98]" : "cursor-not-allowed"}`}
              >
                {!unlocked && i === 0 && <TimeRing frac={frac} />}
                {label}
              </button>
            ))}
          </div>
        )}
        {screen.action.kind === "next" && (
          <div className="flex gap-2">
            {screen.side && (
              <button onClick={screen.side.onClick} className="rounded-2xl border border-line bg-card px-4 py-3 font-semibold text-ink-soft">
                {screen.side.label}
              </button>
            )}
            <button
              disabled={!unlocked}
              onClick={onNext}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-base font-semibold text-paper ${unlocked ? "" : "opacity-40"}`}
            >
              {!unlocked && <TimeRing frac={frac} />}
              {screen.action.label ?? L.next}
            </button>
          </div>
        )}
        {screen.action.kind === "choices" && (
          <div className={`grid gap-2 ${screen.action.buttons.length > 1 ? "grid-cols-2" : ""} ${unlocked ? "" : "opacity-40"}`}>
            {screen.action.buttons.map((b) => (
              <button
                key={b.label}
                disabled={!unlocked}
                onClick={b.onPick}
                className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 font-semibold ${
                  b.tone === "good" ? RATING_STYLE[2] : b.tone === "bad" ? RATING_STYLE[0] : "border-ink bg-ink text-paper"
                }`}
              >
                {!unlocked && <TimeRing frac={frac} />}
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

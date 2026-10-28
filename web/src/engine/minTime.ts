/** Minimum seconds on each screen before the rating (or "Next step") unlocks. */
import type { Lang } from "./types";

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Words on a screen. Hindi and English both split on spaces. */
export function words(...texts: (string | undefined | null)[]): number {
  return texts.reduce((n, t) => n + (t ? t.trim().split(/\s+/).filter(Boolean).length : 0), 0);
}

/** Hindi (Devanagari) reads a little slower; adult course, so no child factor. */
export function langFactor(lang: Lang): number {
  return lang === "hi" ? 1.15 : 1;
}

export type Screen = "fact_learn" | "fact_recall" | "step" | "math_step" | "summary" | "explain";

export function minSeconds(screen: Screen, wordCount: number, lang: Lang, override?: number): number {
  if (override && override > 0) return override;
  const f = langFactor(lang);
  const w = wordCount;
  switch (screen) {
    case "fact_learn":
      return Math.round(clamp((w / 2 + 2) * f, 5, 25));
    case "fact_recall":
      return Math.round(clamp((w / 2.5) * f, 3, 15));
    case "step":
      return Math.round(clamp((w / 2 + 3) * f, 6, 30));
    case "math_step":
      return Math.round(clamp((w / 2 + 6) * f, 8, 40));
    case "summary":
      return Math.round(clamp((w / 2) * f, 8, 30));
    case "explain":
      return Math.round(clamp((w / 2) * f, 4, 20));
  }
}

/** Thinking time before "Show answer" on a recall view. */
export const RECALL_THINK_SECONDS = 4;

/** Rough seconds a card takes, for "about N min" and the daily plan. */
export function estimateSeconds(type: string, isNew: boolean): number {
  switch (type) {
    case "math":
    case "reasoning":
      return isNew ? 150 : 70;
    case "steps":
      return isNew ? 90 : 35;
    case "diagram":
      return isNew ? 120 : 60;
    case "summary":
      return 25;
    default:
      return isNew ? 30 : 15;
  }
}

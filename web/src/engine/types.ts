/** Shared types for the Algo UPSC learning engine. */

export type Lang = "en" | "hi";
export const LANGS: Lang[] = ["en", "hi"];

/** A text object: one string per course language. */
export type T = Record<Lang, string>;

export type CardType = "fact" | "steps" | "math" | "reasoning" | "diagram" | "summary";

/** 1 Didn't get it · 2 Tough · 3 Understood · 4 So simple (FSRS Again/Hard/Good/Easy). */
export type Rating = 1 | 2 | 3 | 4;

export type Mode = "learn" | "recall" | "check" | "test" | "cram" | "honesty";

/** What the planner needs to know about a card (no lesson text). */
export interface CardMeta {
  id: string;
  topic: string;
  type: CardType;
  seq: number;
  difficulty: number;
  freq: number;
}

/** A learner's saved state for one card (mirrors upsc.card_state). */
export interface CardState {
  card_id: string;
  due: string; // ISO
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3; // new, learning, review, relearning
  last_review: string | null;
  last_rating: Rating | null;
  recent: Rating[];
  ever_tough: boolean;
  tough_streak: number;
  honesty_misses: number;
  honesty_due: string | null;
  first_seen?: string;
}

export interface LearnerPrefs {
  lang: Lang;
  exam_date: string; // YYYY-MM-DD
  study_times: string[]; // HH:MM local
  minutes_per_day: number;
  quiet_start: string;
  quiet_end: string;
  timezone: string;
  focus_size: number;
}

export interface SittingItem {
  card_id: string;
  mode: Mode;
}

export type SittingKind = "normal" | "bonus" | "cram" | "welcome";

export interface EngineConfig {
  retention: number;
  sitting_max: number;
  min_new_per_day: number;
  bonus_gap_minutes: number;
  bonus_per_day: number;
  honesty_rate: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  retention: 0.9,
  sitting_max: 10,
  min_new_per_day: 5,
  bonus_gap_minutes: 90,
  bonus_per_day: 2,
  honesty_rate: 0.2,
};

/** Cards that take longer count as two slots in a sitting. */
export const LONG_TYPES: CardType[] = ["math", "reasoning", "diagram"];

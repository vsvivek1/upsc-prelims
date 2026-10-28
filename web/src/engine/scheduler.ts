/**
 * SchedulerService: wraps ts-fsrs (FSRS-6) so the rest of the app never touches it directly.
 * Adds the Recallio rules on top: exam-date cap, "still tough" push, honesty checks.
 */
import { createEmptyCard, fsrs, generatorParameters, Rating as FR, type Card, type Grade } from "ts-fsrs";
import { DAY_MS, zonedInstant, addDays } from "./dates";
import type { CardState, Rating } from "./types";

export interface RateOptions {
  now: Date;
  examDate: string; // YYYY-MM-DD
  timezone?: string;
  retention?: number;
  honestyRate?: number;
  rng?: () => number;
}

const GRADE: Record<Rating, Grade> = { 1: FR.Again, 2: FR.Hard, 3: FR.Good, 4: FR.Easy };

function toFsrs(s: CardState | null, now: Date): Card {
  if (!s) return createEmptyCard(now);
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: 0,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  };
}

/** Tough or Didn't get it in 2 of the last 3 ratings. */
export function isStillTough(recent: Rating[]): boolean {
  return recent.slice(-3).filter((r) => r <= 2).length >= 2;
}

/** Ever tough, last two ratings Understood or better, no honesty miss since. */
export function becameEasy(s: Pick<CardState, "ever_tough" | "recent" | "honesty_misses">): boolean {
  const last2 = s.recent.slice(-2);
  return s.ever_tough && last2.length === 2 && last2.every((r) => r >= 3) && s.honesty_misses === 0;
}

/** Was Understood or So simple, then Didn't get it. */
export function slipped(recent: Rating[]): boolean {
  const n = recent.length;
  return n >= 2 && recent[n - 1] === 1 && recent[n - 2] >= 3;
}

/** No review may land after exam − 3 days (start of that local day). */
export function examCap(examDate: string, tz = "Asia/Kolkata"): Date {
  return zonedInstant(addDays(examDate, -3), "06:00", tz);
}

export function makeScheduler(retention = 0.9) {
  return fsrs(generatorParameters({ request_retention: retention, enable_fuzz: true, enable_short_term: true }));
}

/** Predicted recall (0–1) of a card right now. New cards count as 0. */
export function retrievability(s: CardState | null, now: Date, retention = 0.9): number {
  if (!s || s.state === 0 || !s.last_review) return 0;
  return makeScheduler(retention).get_retrievability(toFsrs(s, now), now, false);
}

/**
 * Applies one rating and returns the new saved state.
 * `honestyResult` is set when the card was shown as an honesty check.
 */
export function rate(
  prev: CardState | null,
  cardId: string,
  rating: Rating,
  opts: RateOptions,
  honestyResult?: "right" | "wrong",
): CardState {
  const { now, examDate } = opts;
  const tz = opts.timezone ?? "Asia/Kolkata";
  const rng = opts.rng ?? Math.random;
  const f = makeScheduler(opts.retention ?? 0.9);

  let recent = prev?.recent ?? [];
  let honestyMisses = prev?.honesty_misses ?? 0;
  let honestyDue = prev?.honesty_due ?? null;

  // Failed honesty check: back to the start.
  let grade: Grade = GRADE[rating];
  if (honestyResult === "wrong") {
    grade = FR.Again;
    honestyMisses += 1;
    honestyDue = null;
  } else if (honestyResult === "right") {
    honestyDue = null;
  } else if (rating === 2 && isStillTough(recent)) {
    // Still tough: shorten the next interval once by treating Hard as Again.
    grade = FR.Again;
  }

  const firstShowing = !prev || prev.reps === 0;
  const result = f.next(toFsrs(prev, now), now, grade).card;

  // Exam cap: every card is seen again before cram mode.
  const cap = examCap(examDate, tz);
  let due = result.due;
  if (due > cap) {
    // Inside the last three days, nothing is scheduled past the exam morning.
    const examMorning = zonedInstant(examDate, "06:00", tz);
    due = now < cap ? cap : due < examMorning ? due : examMorning > now ? examMorning : now;
  }

  // Honesty check for "So simple" on a first showing.
  if (!honestyResult && rating === 4 && firstShowing && rng() < (opts.honestyRate ?? 0.2)) {
    const days = 1 + Math.floor(rng() * 3);
    const at = new Date(now.getTime() + days * DAY_MS);
    honestyDue = (at < due ? at : due).toISOString();
  }

  recent = [...recent, rating].slice(-3) as Rating[];
  return {
    card_id: cardId,
    due: due.toISOString(),
    stability: result.stability,
    difficulty: result.difficulty,
    scheduled_days: result.scheduled_days,
    learning_steps: result.learning_steps,
    reps: result.reps,
    lapses: result.lapses,
    state: result.state as CardState["state"],
    last_review: now.toISOString(),
    last_rating: rating,
    recent,
    ever_tough: (prev?.ever_tough ?? false) || rating <= 2,
    tough_streak: rating <= 2 ? (prev?.tough_streak ?? 0) + 1 : 0,
    honesty_misses: honestyMisses,
    honesty_due: honestyDue,
  };
}

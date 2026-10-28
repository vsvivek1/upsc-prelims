/**
 * Daily plan: works backwards from the exam date to today's quota.
 * Pure functions: the feed passes in everything, so the same rules can be ported to Dart.
 */
import { addDays, daysBetween, hm, inQuietHours, localDay, localMinutes, toHm, zonedInstant } from "./dates";
import { estimateSeconds } from "./minTime";
import { isStillTough, retrievability } from "./scheduler";
import { DEFAULT_CONFIG, type CardMeta, type CardState, type EngineConfig, type LearnerPrefs } from "./types";

export type Phase = "learn" | "revision" | "cram" | "exam_day" | "after";

export interface PlanInput {
  now: Date;
  prefs: LearnerPrefs;
  cards: CardMeta[]; // every card the learner can open, any order
  states: Map<string, CardState>;
  totalCards: number; // whole course, including locked cards
  locked: boolean; // free learner with cards still locked beyond the free limit
  config?: EngineConfig;
}

export interface Plan {
  today: string;
  daysLeft: number;
  phase: Phase;
  newPerDay: number;
  newToday: CardMeta[]; // new cards still to learn today, in order
  dueToday: CardMeta[]; // reviews still due today, most-forgotten first
  doneToday: number; // cards rated today
  quota: number;
  left: number;
  minutesLeft: number;
  behindPlan: boolean;
  outOfFreeCards: boolean; // free cards all learned and more are locked
  seenCount: number;
}

export function phaseFor(today: string, examDate: string): { phase: Phase; daysLeft: number } {
  const daysLeft = daysBetween(today, examDate);
  if (daysLeft < 0) return { phase: "after", daysLeft };
  if (daysLeft === 0) return { phase: "exam_day", daysLeft };
  if (daysLeft <= 2) return { phase: "cram", daysLeft };
  // The last two weeks before cram are the revision window: reviews and mocks, few new cards.
  return { phase: daysLeft <= 16 ? "revision" : "learn", daysLeft };
}

export function buildPlan(input: PlanInput): Plan {
  const cfg = input.config ?? DEFAULT_CONFIG;
  const { now, prefs, states } = input;
  const tz = prefs.timezone;
  const today = localDay(now, tz);
  const { phase, daysLeft } = phaseFor(today, prefs.exam_date);
  const endOfToday = zonedInstant(addDays(today, 1), "00:00", tz);

  const ordered = [...input.cards].sort((a, b) => a.seq - b.seq);
  const reviewedToday = (s: CardState | undefined) => !!s?.last_review && localDay(new Date(s.last_review), tz) === today;
  const firstSeenToday = (s: CardState | undefined) =>
    !!s && !!s.first_seen && localDay(new Date(s.first_seen), tz) === today;

  let doneToday = 0;
  let newSeenToday = 0;
  let reviewsDoneToday = 0;
  for (const s of states.values()) {
    if (reviewedToday(s)) {
      doneToday++;
      if (firstSeenToday(s)) newSeenToday++;
      else reviewsDoneToday++;
    }
  }

  const unseen = ordered.filter((c) => !states.has(c.id));
  const seenCount = ordered.length - unseen.length;
  // New cards left in the whole course at the start of today (locked ones count: the plan covers the syllabus).
  const lockedCount = Math.max(0, input.totalCards - input.cards.length);
  const newLeftAtStart = unseen.length + newSeenToday + lockedCount;
  const revisionWindow = Math.min(14, Math.round(Math.max(daysLeft, 0) * 0.15));
  const learnDays = Math.max(1, daysLeft - revisionWindow - 2);

  let newPerDay = 0;
  if (phase === "learn" || phase === "revision") {
    newPerDay = Math.min(newLeftAtStart, Math.max(cfg.min_new_per_day, Math.ceil(newLeftAtStart / learnDays)));
  }
  let newRemaining = Math.max(0, newPerDay - newSeenToday);

  // Due reviews (not already reviewed today), lowest predicted recall first, tough history first.
  const reviewCap = Math.max(0, 2 * newPerDay + 20 - reviewsDoneToday);
  const due = ordered
    .filter((c) => {
      const s = states.get(c.id);
      if (!s || reviewedToday(s)) return false;
      const honesty = s.honesty_due && new Date(s.honesty_due) <= endOfToday;
      return new Date(s.due) <= endOfToday || !!honesty;
    })
    .map((c) => ({ c, r: retrievability(states.get(c.id)!, now, cfg.retention), tough: states.get(c.id)!.ever_tough }))
    .sort((a, b) => (a.tough === b.tough ? a.r - b.r : a.tough ? -1 : 1))
    .map((x) => x.c);
  let dueToday = due.slice(0, reviewCap);
  if (phase === "cram" || phase === "exam_day") {
    // Cram: a summary per topic, every still-tough card, then the most-asked facts.
    const notToday = ordered.filter((c) => !reviewedToday(states.get(c.id)));
    const summaries = notToday.filter((c) => c.type === "summary");
    const tough = notToday.filter((c) => c.type !== "summary" && isStillTough(states.get(c.id)?.recent ?? []));
    const rest = notToday
      .filter((c) => c.type !== "summary" && states.has(c.id) && !tough.includes(c))
      .sort((a, b) => b.freq - a.freq);
    const easyFirst = phase === "exam_day" ? rest.filter((c) => c.difficulty <= 2).slice(0, 10) : [];
    dueToday = phase === "exam_day" ? easyFirst : [...summaries, ...tough, ...rest];
  }

  // Fit the learner's free minutes: drop new cards from the lowest-frequency end first.
  let newToday = unseen.slice(0, Math.min(newRemaining, unseen.length));
  const secs = (list: CardMeta[], isNew: boolean) => list.reduce((n, c) => n + estimateSeconds(c.type, isNew), 0);
  const budget = prefs.minutes_per_day * 60;
  let behindPlan = false;
  while (newToday.length > 0 && secs(newToday, true) + secs(dueToday, false) > budget) {
    let lowest = 0;
    newToday.forEach((c, i) => {
      if (c.freq < newToday[lowest].freq) lowest = i;
    });
    newToday = newToday.filter((_, i) => i !== lowest);
    behindPlan = true;
  }
  newRemaining = newToday.length;

  const outOfFreeCards = input.locked && unseen.length === 0 && newPerDay > newSeenToday;
  const left = newRemaining + dueToday.length;
  return {
    today,
    daysLeft,
    phase,
    newPerDay,
    newToday,
    dueToday,
    doneToday,
    quota: doneToday + left,
    left,
    minutesLeft: Math.ceil((secs(newToday, true) + secs(dueToday, false)) / 60),
    behindPlan,
    outOfFreeCards,
    seenCount,
  };
}

export interface SittingTimeInput {
  now: Date;
  prefs: LearnerPrefs;
  quotaLeft: number;
  lastFinishedAt: Date | null; // end of the last sitting today
  bonusDoneToday: number;
  config?: EngineConfig;
}

export interface NextSitting {
  /** "now": a sitting can start; "at": next one opens at `time`; "tomorrow": done for today. */
  status: "now" | "at" | "tomorrow";
  time?: string; // HH:MM local
  bonus: boolean;
}

/**
 * When can the next sitting start?
 * Normal sittings: whenever quota is left (study times are the alerts, not locks).
 * Bonus sittings: only after the gap, at most N a day, never in quiet hours.
 */
export function nextSitting(input: SittingTimeInput): NextSitting {
  const cfg = input.config ?? DEFAULT_CONFIG;
  const { prefs } = input;
  const nowMin = localMinutes(input.now, prefs.timezone);
  if (input.quotaLeft > 0) {
    return { status: "now", bonus: false };
  }
  if (input.bonusDoneToday >= cfg.bonus_per_day) return { status: "tomorrow", bonus: true };
  const lastMin = input.lastFinishedAt ? localMinutes(input.lastFinishedAt, prefs.timezone) : nowMin;
  const sameDay =
    input.lastFinishedAt && localDay(input.lastFinishedAt, prefs.timezone) === localDay(input.now, prefs.timezone);
  const openAt = sameDay ? lastMin + cfg.bonus_gap_minutes : nowMin;
  if (openAt >= 1440 || inQuietHours(Math.min(openAt, 1439), prefs.quiet_start, prefs.quiet_end)) {
    return { status: "tomorrow", bonus: true };
  }
  if (openAt <= nowMin) {
    return inQuietHours(nowMin, prefs.quiet_start, prefs.quiet_end)
      ? { status: "tomorrow", bonus: true }
      : { status: "now", bonus: true };
  }
  return { status: "at", time: toHm(openAt), bonus: true };
}

/** The next study time today after now (for "Next sitting at 5:30 PM"), or the first one tomorrow. */
export function nextStudyTime(now: Date, prefs: LearnerPrefs): { time: string; tomorrow: boolean } | null {
  const times = [...prefs.study_times].sort((a, b) => hm(a) - hm(b));
  if (!times.length) return null;
  const nowMin = localMinutes(now, prefs.timezone);
  const later = times.find((t) => hm(t) > nowMin);
  return later ? { time: later, tomorrow: false } : { time: times[0], tomorrow: true };
}

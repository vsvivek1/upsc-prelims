import { describe, expect, it } from "vitest";
import {
  arrange,
  becameEasy,
  buildPlan,
  buildSitting,
  examCap,
  isStillTough,
  localDay,
  minSeconds,
  nextSitting,
  phaseFor,
  rate,
  slipped,
  zonedInstant,
  type CardMeta,
  type CardState,
  type LearnerPrefs,
} from "../src/engine";

const prefs: LearnerPrefs = {
  lang: "en",
  exam_date: "2027-05-23",
  study_times: ["07:00", "13:30", "19:00"],
  minutes_per_day: 30,
  quiet_start: "21:30",
  quiet_end: "06:30",
  timezone: "Asia/Kolkata",
  focus_size: 10,
};
const at = (day: string, time: string) => zonedInstant(day, time, "Asia/Kolkata");
const DAY = 86_400_000;

function cards(n: number, topics = 5): CardMeta[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i + 1}`,
    topic: `t${i % topics}`,
    type: "fact" as const,
    seq: i + 1,
    difficulty: (i % 5) + 1,
    freq: ((i * 37) % 100) / 100,
  }));
}

describe("dates", () => {
  it("converts IST local time to the right instant", () => {
    expect(at("2026-10-28", "07:00").toISOString()).toBe("2026-10-28T01:30:00.000Z");
    expect(localDay(new Date("2026-10-28T19:00:00Z"))).toBe("2026-10-29");
  });
});

describe("minimum time", () => {
  it("follows the clamps and the Hindi factor", () => {
    expect(minSeconds("fact_learn", 2, "en")).toBe(5);
    expect(minSeconds("fact_learn", 30, "en")).toBe(17);
    expect(minSeconds("fact_learn", 30, "hi")).toBe(20);
    expect(minSeconds("fact_learn", 100, "en")).toBe(25);
    expect(minSeconds("math_step", 10, "en")).toBe(11);
    expect(minSeconds("summary", 40, "en", 12)).toBe(12);
  });
});

describe("scheduler", () => {
  const now = at("2026-11-01", "07:00");
  const opts = { now, examDate: "2027-05-23", rng: () => 0.99 };

  it("gives longer intervals for better ratings", () => {
    const due = (r: 1 | 2 | 3 | 4) => new Date(rate(null, "c1", r, opts).due).getTime() - now.getTime();
    expect(due(1)).toBeLessThan(due(3));
    expect(due(2)).toBeLessThanOrEqual(due(3));
    expect(due(3)).toBeLessThan(due(4));
    expect(due(4)).toBeGreaterThan(DAY); // So simple pushes it out by days
  });

  it("never schedules after exam − 3 days", () => {
    let s: CardState | null = null;
    let t = now;
    const cap = examCap("2027-05-23").getTime();
    const examMorning = zonedInstant("2027-05-23", "06:00", "Asia/Kolkata").getTime();
    for (let i = 0; i < 8; i++) {
      const before = t.getTime() < cap;
      s = rate(s, "c1", 4, { ...opts, now: t });
      if (before) expect(new Date(s.due).getTime()).toBeLessThanOrEqual(cap);
      expect(new Date(s.due).getTime()).toBeLessThanOrEqual(examMorning);
      t = new Date(s.due);
    }
  });

  it("tracks tough history and becomes easy", () => {
    let s = rate(null, "c1", 2, opts);
    expect(s.ever_tough).toBe(true);
    s = rate(s, "c1", 1, { ...opts, now: new Date(s.due) });
    expect(isStillTough(s.recent)).toBe(true);
    s = rate(s, "c1", 3, { ...opts, now: new Date(s.due) });
    s = rate(s, "c1", 3, { ...opts, now: new Date(s.due) });
    expect(becameEasy(s)).toBe(true);
    expect(s.recent).toEqual([1, 3, 3]);
  });

  it("treats Hard as Again for a still-tough card", () => {
    const base = rate(rate(null, "c1", 2, opts), "c1", 2, opts);
    const hard = rate(base, "c1", 2, { ...opts, now: new Date(now.getTime() + 2 * DAY) });
    const again = rate(base, "c1", 1, { ...opts, now: new Date(now.getTime() + 2 * DAY) });
    expect(hard.lapses).toBe(again.lapses);
  });

  it("schedules an honesty check for some So simple ratings and resets on a miss", () => {
    const s = rate(null, "c1", 4, { ...opts, rng: () => 0.1 });
    expect(s.honesty_due).not.toBeNull();
    const failed = rate(s, "c1", 1, { ...opts, now: new Date(s.honesty_due!) }, "wrong");
    expect(failed.honesty_misses).toBe(1);
    expect(failed.honesty_due).toBeNull();
    expect(slipped([4, 1])).toBe(true);
  });
});

describe("planner", () => {
  it("knows the phases", () => {
    expect(phaseFor("2026-10-28", "2027-05-23").phase).toBe("learn");
    expect(phaseFor("2027-05-21", "2027-05-23").phase).toBe("cram");
    expect(phaseFor("2027-05-23", "2027-05-23").phase).toBe("exam_day");
    expect(phaseFor("2027-05-10", "2027-05-23").phase).toBe("revision");
  });

  it("spreads new cards over the days left", () => {
    const all = cards(2000);
    const plan = buildPlan({
      now: at("2026-10-28", "07:00"),
      prefs: { ...prefs, minutes_per_day: 120 },
      cards: all,
      states: new Map(),
      totalCards: all.length,
      locked: false,
    });
    // 207 days left, revision 14, cram 2 → 191 learn days → ceil(2000/191) = 11
    expect(plan.newPerDay).toBe(11);
    expect(plan.newToday).toHaveLength(11);
    expect(plan.quota).toBe(11);
  });

  it("drops low-frequency new cards when time is short", () => {
    const all = cards(2000);
    const plan = buildPlan({
      now: at("2026-10-28", "07:00"),
      prefs: { ...prefs, minutes_per_day: 5 },
      cards: all,
      states: new Map(),
      totalCards: all.length,
      locked: false,
    });
    expect(plan.behindPlan).toBe(true);
    expect(plan.newToday.length).toBe(10); // 10 × 30 s = 5 min
  });

  it("flags when free cards run out", () => {
    const free = cards(3);
    const states = new Map<string, CardState>();
    const past = at("2026-10-20", "07:00");
    for (const c of free) states.set(c.id, rate(null, c.id, 3, { now: past, examDate: "2027-05-23" }));
    const plan = buildPlan({
      now: at("2026-10-28", "07:00"),
      prefs,
      cards: free,
      states,
      totalCards: 500,
      locked: true,
    });
    expect(plan.outOfFreeCards).toBe(true);
  });
});

describe("sittings", () => {
  it("holds at most 10 slots, counts long cards twice and starts and ends easy", () => {
    const all = cards(40).map((c, i) => (i % 7 === 0 ? { ...c, type: "math" as const } : c));
    const map = new Map(all.map((c) => [c.id, c]));
    const plan = buildPlan({
      now: at("2026-10-28", "07:00"),
      prefs: { ...prefs, minutes_per_day: 300 },
      cards: all,
      states: new Map(),
      totalCards: 4000,
      locked: false,
    });
    const items = buildSitting({ plan, states: new Map(), cards: map, focusSize: 10, kind: "normal", now: at("2026-10-28", "07:00"), timezone: "Asia/Kolkata" });
    const slots = items.reduce((n, it) => n + (map.get(it.card_id)!.type === "math" ? 2 : 1), 0);
    expect(slots).toBeLessThanOrEqual(10);
    const diffs = items.map((it) => map.get(it.card_id)!.difficulty);
    expect(diffs[0]).toBe(Math.min(...diffs));
    expect(diffs[diffs.length - 1]).toBeLessThanOrEqual(Math.min(...diffs.slice(1, -1)));
  });

  it("avoids the same topic back to back", () => {
    const all = cards(10, 3);
    const out = arrange(all.map((card) => ({ card })));
    for (let i = 1; i < out.length - 1; i++) expect(out[i].card.topic).not.toBe(out[i - 1].card.topic);
  });

  it("opens a bonus sitting only after the gap", () => {
    const last = at("2026-10-28", "18:00");
    const r = nextSitting({ now: at("2026-10-28", "18:30"), prefs, quotaLeft: 0, lastFinishedAt: last, normalDoneToday: 3, bonusDoneToday: 0 });
    expect(r).toEqual({ status: "at", time: "19:30", bonus: true });
    const late = nextSitting({ now: at("2026-10-28", "21:00"), prefs, quotaLeft: 0, lastFinishedAt: at("2026-10-28", "20:30"), normalDoneToday: 3, bonusDoneToday: 0 });
    expect(late.status).toBe("tomorrow");
    const max = nextSitting({ now: at("2026-10-28", "12:00"), prefs, quotaLeft: 0, lastFinishedAt: last, normalDoneToday: 3, bonusDoneToday: 2 });
    expect(max.status).toBe("tomorrow");
  });

  it("opens quota sittings at study times and lets missed ones catch up", () => {
    const base = { prefs, quotaLeft: 20, bonusDoneToday: 0 };
    // First sitting of the day opens at once.
    expect(nextSitting({ ...base, now: at("2026-10-28", "06:45"), lastFinishedAt: null, normalDoneToday: 0 }).status).toBe("now");
    // After the 07:00 sitting, the next opens at 08:10 (catch-up gap) or 13:30, whichever is first.
    const r = nextSitting({ ...base, now: at("2026-10-28", "07:15"), lastFinishedAt: at("2026-10-28", "07:10"), normalDoneToday: 1 });
    expect(r).toEqual({ status: "at", time: "08:10", bonus: false });
    // Missed the 13:30 time: open now.
    expect(nextSitting({ ...base, now: at("2026-10-28", "16:00"), lastFinishedAt: at("2026-10-28", "07:10"), normalDoneToday: 1 }).status).toBe("now");
  });
});

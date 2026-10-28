/** Builds one sitting: at most 10 slots, easy first and last, no two of a topic back to back. */
import { localDay } from "./dates";
import type { Plan } from "./planner";
import { DEFAULT_CONFIG, LONG_TYPES, type CardMeta, type CardState, type EngineConfig, type SittingItem, type SittingKind } from "./types";

export interface SittingInput {
  plan: Plan;
  states: Map<string, CardState>;
  cards: Map<string, CardMeta>;
  focusSize: number;
  kind: SittingKind;
  now: Date;
  timezone: string;
  /** For bonus sittings: reviews due in the next 2 days and tomorrow's new cards. */
  bonusPool?: { reviews: CardMeta[]; fresh: CardMeta[] };
  config?: EngineConfig;
}

const slotsOf = (c: CardMeta) => (LONG_TYPES.includes(c.type) ? 2 : 1);

export function buildSitting(input: SittingInput): SittingItem[] {
  const cfg = input.config ?? DEFAULT_CONFIG;
  const { plan, states, now, timezone } = input;
  const today = localDay(now, timezone);
  let slots = Math.min(cfg.sitting_max, Math.max(5, input.focusSize));
  if (input.kind === "welcome") slots = 5;
  if (input.kind !== "bonus") slots = Math.min(slots, Math.max(plan.left, 0));

  const picked: { card: CardMeta; mode: SittingItem["mode"] }[] = [];
  let used = 0;
  const take = (card: CardMeta, mode: SittingItem["mode"]) => {
    if (picked.some((p) => p.card.id === card.id)) return false;
    const need = slotsOf(card);
    if (used + need > slots) return false;
    picked.push({ card, mode });
    used += need;
    return true;
  };

  const cram = plan.phase === "cram" || plan.phase === "exam_day";
  const reviewMode = (c: CardMeta): SittingItem["mode"] => {
    const s = states.get(c.id);
    if (cram) return "cram";
    if (s?.honesty_due && new Date(s.honesty_due) <= now && c.type === "fact") return "honesty";
    return "recall";
  };

  if (input.kind === "bonus" && input.bonusPool) {
    for (const c of input.bonusPool.reviews) take(c, "recall");
    let fresh = 0;
    for (const c of input.bonusPool.fresh) if (fresh < 5 && take(c, "learn")) fresh++;
  } else {
    // 1. Cards that got "Didn't get it" earlier today (they are due again within minutes) — at most 2.
    const againToday = [...states.values()]
      .filter((s) => s.last_rating === 1 && s.last_review && localDay(new Date(s.last_review), timezone) === today)
      .map((s) => input.cards.get(s.card_id))
      .filter((c): c is CardMeta => !!c);
    againToday.slice(0, 2).forEach((c) => take(c, cram ? "cram" : "recall"));

    // 2. Due reviews — up to 60 % of slots (all of them in cram mode).
    const reviewShare = cram || plan.newToday.length === 0 ? slots : Math.ceil(slots * 0.6);
    for (const c of plan.dueToday) {
      if (used >= reviewShare) break;
      take(c, reviewMode(c));
    }
    // 3. New cards from today's plan.
    for (const c of plan.newToday) take(c, "learn");
    // 4. Any room left: more reviews.
    for (const c of plan.dueToday) take(c, reviewMode(c));
  }

  return arrange(picked).map((p) => ({ card_id: p.card.id, mode: p.mode }));
}

/** Easiest first and last; avoid same topic or two long cards back to back. */
export function arrange<X extends { card: CardMeta }>(items: X[]): X[] {
  if (items.length <= 2) return [...items].sort((a, b) => a.card.difficulty - b.card.difficulty);
  const pool = [...items].sort((a, b) => a.card.difficulty - b.card.difficulty);
  const first = pool.shift()!;
  const last = pool.shift()!;
  const middle: X[] = [];
  let prev = first;
  // Hardest in the middle: take from the harder end first, then keep variety.
  const rest = pool.reverse();
  while (rest.length) {
    const i = rest.findIndex(
      (x) =>
        x.card.topic !== prev.card.topic &&
        !(LONG_TYPES.includes(x.card.type) && LONG_TYPES.includes(prev.card.type)),
    );
    const next = rest.splice(i >= 0 ? i : 0, 1)[0];
    middle.push(next);
    prev = next;
  }
  // Put the hardest near the centre: middle currently hardest-first; rotate so it peaks in the middle.
  const half = Math.floor(middle.length / 2);
  const centred = [...middle.slice(half).reverse(), ...middle.slice(0, half)];
  // Re-check neighbours after rotation; fall back to the unrotated order if it created a clash.
  const clash = (list: X[]) =>
    list.some(
      (x, i) =>
        i > 0 &&
        (x.card.topic === list[i - 1].card.topic ||
          (LONG_TYPES.includes(x.card.type) && LONG_TYPES.includes(list[i - 1].card.type))),
    );
  const body = clash([first, ...centred, last]) && !clash([first, ...middle, last]) ? middle : centred;
  return [first, ...body, last];
}

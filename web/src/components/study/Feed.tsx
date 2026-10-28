"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  buildPlan,
  buildSitting,
  DEFAULT_CONFIG,
  LONG_TYPES,
  localDay,
  nextSitting,
  nextStudyTime,
  rate,
  type CardMeta,
  type CardState,
  type Lang,
  type Rating,
  type SittingItem,
  type SittingKind,
} from "@/engine";
import { tx, type CardRow, type QuestionRow, type TopicRow } from "@/lib/content";
import {
  createSitting,
  loadAnsweredQuestionIds,
  loadCardMetas,
  loadCourse,
  loadOpenSitting,
  loadPayloads,
  loadQuestionIndex,
  loadQuestions,
  loadRecentSittings,
  loadStates,
  loadStats,
  loadStudyDays,
  loadTopics,
  makeDueNow,
  saveRating,
  saveTestAnswers,
  updateSitting,
  type Course,
  type Learner,
  type Sitting,
  type Stats,
  saveQuota,
} from "@/lib/data";
import { clock, t } from "@/lib/i18n";
import { callFunction, sb } from "@/lib/supabase";
import { FactCard } from "./cards/FactCard";
import { StepsCard } from "./cards/StepsCard";
import { MathCard } from "./cards/MathCard";
import { DiagramCard } from "./cards/DiagramCard";
import { SummaryCard } from "./cards/SummaryCard";
import { TestCard, type TestResult } from "./cards/TestCard";
import type { CardProps } from "./cards/types";
import { FeedHeader } from "./FeedHeader";
import { BetweenSittings } from "./BetweenSittings";
import { ProfileSheet } from "./ProfileSheet";
import { useEvery, useSeenSeconds } from "./hooks";

interface Ctx {
  course: Course;
  stats: Stats;
  metas: Map<string, CardMeta>;
  metaList: CardMeta[];
  states: Map<string, CardState>;
  topics: Map<string, TopicRow>;
  qIndex: { id: string; topic: string; covers: string[] }[];
  answered: Set<string>;
  sittings: Sitting[];
  studyDays: string[];
}

const LS_KEY = "algo-upsc-seconds";

export function Feed({ userId, learner, onLearner }: { userId: string; learner: Learner; onLearner: (l: Learner) => void }) {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sitting, setSitting] = useState<Sitting | null>(null);
  const [payloads, setPayloads] = useState<Map<string, CardRow>>(new Map());
  const [tests, setTests] = useState<Map<string, QuestionRow[]>>(new Map());
  const [cardLang, setCardLang] = useState<Lang>(learner.lang);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const starting = useRef(false);
  const L = t(learner.lang);

  // Refresh "now" every 30 s so "Next sitting" screens open on time.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => setCardLang(learner.lang), [learner.lang]);

  const load = useCallback(async () => {
    try {
      const [course, stats, metaList, states, topics, qIndex, answered, open, sittings, studyDays] = await Promise.all([
        loadCourse(),
        loadStats(),
        loadCardMetas(),
        loadStates(),
        loadTopics(),
        loadQuestionIndex(),
        loadAnsweredQuestionIds(),
        loadOpenSitting(),
        loadRecentSittings(),
        loadStudyDays(),
      ]);
      setCtx({
        course,
        stats,
        metas: new Map(metaList.map((c) => [c.id, c])),
        metaList,
        states: new Map(states.map((s) => [s.card_id, s])),
        topics: new Map(topics.map((tp) => [tp.id, tp])),
        qIndex,
        answered,
        sittings,
        studyDays,
      });
      setSitting(open);
      setNow(new Date());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Back button / gesture never pops the card: it shows a note and stays.
  useEffect(() => {
    history.pushState({ feed: true }, "");
    const onPop = () => {
      history.pushState({ feed: true }, "");
      setToast(t(learner.lang).backSaved);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [learner.lang]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const locked = !!ctx && !ctx.stats.has_access && ctx.stats.total_cards > ctx.metaList.length;
  const plan = useMemo(
    () =>
      ctx
        ? buildPlan({ now, prefs: learner, cards: ctx.metaList, states: ctx.states, totalCards: ctx.stats.total_cards, locked })
        : null,
    [ctx, now, learner, locked],
  );

  const today = localDay(now, learner.timezone);

  // Keep the server's copy of today's quota current for study alerts.
  const quotaSaved = useRef("");
  useEffect(() => {
    if (!plan) return;
    const snap = { day: plan.today, total: plan.quota, left: plan.left, minutes: plan.minutesLeft };
    const sig = JSON.stringify(snap);
    if (sig === quotaSaved.current) return;
    quotaSaved.current = sig;
    saveQuota(userId, snap).catch(() => {
      quotaSaved.current = "";
    });
  }, [plan, userId]);
  const todays = useMemo(() => (ctx ? ctx.sittings.filter((s) => s.day === today) : []), [ctx, today]);
  const finishedToday = todays.filter((s) => s.finished_at);
  const lastFinished = finishedToday.length ? new Date(finishedToday[finishedToday.length - 1].finished_at!) : null;
  const next = plan
    ? nextSitting({
        now,
        prefs: learner,
        quotaLeft: plan.outOfFreeCards && plan.dueToday.length === 0 ? 0 : plan.left,
        lastFinishedAt: lastFinished,
        normalDoneToday: finishedToday.filter((s) => s.kind !== "bonus").length,
        bonusDoneToday: finishedToday.filter((s) => s.kind === "bonus").length,
      })
    : null;

  const streak = useMemo(() => {
    if (!ctx) return 0;
    const days = new Set(ctx.studyDays.map((d) => localDay(new Date(d), learner.timezone)));
    let n = 0;
    let d = days.has(today) ? today : addDays(today, -1);
    while (days.has(d)) {
      n++;
      d = addDays(d, -1);
    }
    return n;
  }, [ctx, today, learner.timezone]);

  /** Loads lesson text for a sitting's cards and questions for its tests. */
  const hydrate = useCallback(async (s: Sitting) => {
    const ids = s.items.filter((i) => i.mode !== "test").map((i) => i.card_id);
    const rows = await loadPayloads(ids);
    setPayloads((m) => new Map([...m, ...rows.map((r) => [r.id, r] as const)]));
    for (const it of s.items.filter((i) => i.mode === "test")) {
      const topic = it.card_id.slice(5);
      const qs = await loadQuestions(topic);
      setTests((m) => new Map(m).set(it.card_id, qs.slice(0, 5)));
    }
  }, []);

  useEffect(() => {
    if (sitting) hydrate(sitting).catch((e) => setError((e as Error).message));
  }, [sitting?.id, hydrate]); // eslint-disable-line react-hooks/exhaustive-deps

  /** A topic whose cards are all seen and whose questions are not yet answered gets a test. */
  const pickTest = useCallback((): SittingItem | null => {
    if (!ctx) return null;
    const byTopic = new Map<string, string[]>();
    for (const c of ctx.metaList) byTopic.set(c.topic, [...(byTopic.get(c.topic) ?? []), c.id]);
    for (const [topic, ids] of byTopic) {
      if (!ids.every((id) => ctx.states.has(id))) continue;
      const qs = ctx.qIndex.filter((q) => q.topic === topic);
      if (qs.length >= 3 && qs.every((q) => !ctx.answered.has(q.id))) return { card_id: `test:${topic}`, mode: "test" };
    }
    return null;
  }, [ctx]);

  const start = useCallback(
    async (bonus: boolean) => {
      if (!ctx || !plan || starting.current) return;
      starting.current = true;
      try {
        const lastDay = ctx.studyDays[0] ? localDay(new Date(ctx.studyDays[0]), learner.timezone) : null;
        let kind: SittingKind = bonus ? "bonus" : plan.phase === "cram" || plan.phase === "exam_day" ? "cram" : "normal";
        // First sitting ever, or back after missed days: a short, easy start.
        if (!bonus && ctx.states.size === 0) kind = "welcome";
        if (!bonus && lastDay && lastDay < addDays(today, -1) && finishedToday.length === 0) kind = "welcome";
        let bonusPool: { reviews: CardMeta[]; fresh: CardMeta[] } | undefined;
        if (bonus) {
          const soon = new Date(now.getTime() + 2 * 86_400_000);
          const reviews = ctx.metaList
            .filter((c) => {
              const s = ctx.states.get(c.id);
              return s && new Date(s.due) <= soon && !(s.last_review && localDay(new Date(s.last_review), learner.timezone) === today);
            })
            .sort((a, b) => +new Date(ctx.states.get(a.id)!.due) - +new Date(ctx.states.get(b.id)!.due));
          const fresh = ctx.metaList.filter((c) => !ctx.states.has(c.id)).slice(0, 5);
          bonusPool = { reviews, fresh };
        }
        let items = buildSitting({
          plan,
          states: ctx.states,
          cards: ctx.metas,
          focusSize: learner.focus_size,
          kind,
          now,
          timezone: learner.timezone,
          bonusPool,
          config: DEFAULT_CONFIG,
        });
        const test = kind === "normal" ? pickTest() : null;
        if (test && items.length >= 2) items = [...items.slice(0, -1), test, items[items.length - 1]];
        if (!items.length) return;
        const s = await createSitting(userId, today, kind, items);
        setJustFinished(false);
        setSitting(s);
      } catch (e) {
        // Another tab may have opened a sitting: pick it up.
        const open = await loadOpenSitting().catch(() => null);
        if (open) setSitting(open);
        else setError((e as Error).message);
      } finally {
        starting.current = false;
      }
    },
    [ctx, plan, learner, now, today, finishedToday.length, userId, pickTest],
  );

  // The feed opens on a card: when a quota sitting is due, it starts by itself.
  useEffect(() => {
    if (ctx && plan && !sitting && !justFinished && next?.status === "now" && !next.bonus && plan.left > 0) start(false);
  }, [ctx, plan, sitting, justFinished, next?.status, next?.bonus, start]);

  // ---------------------------------------------------------------- current card
  const pos = sitting?.position ?? 0;
  const item = sitting && pos < sitting.items.length ? sitting.items[pos] : null;
  const itemKey = sitting && item ? `${sitting.id}:${pos}:${item.card_id}` : "none";
  const stored = useMemo(() => {
    if (!sitting || !item) return 0;
    let local = 0;
    try {
      local = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}")[itemKey] ?? 0;
    } catch {}
    return Math.max(local, sitting.seconds[item.card_id] ?? 0);
  }, [itemKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const seen = useSeenSeconds(itemKey, stored);

  useEffect(() => {
    if (!item) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ [itemKey]: Math.floor(seen) }));
    } catch {}
  }, [Math.floor(seen)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEvery({ sitting, item, seen }, 5000, ({ sitting: s, item: it, seen: secs }) => {
    if (!s || !it || s.finished_at) return;
    const seconds = { ...s.seconds, [it.card_id]: Math.floor(secs) };
    updateSitting(s.id, { seconds }).catch(() => {});
  });

  const advance = useCallback(
    async (s: Sitting, items: SittingItem[]) => {
      const position = s.position + 1;
      if (position >= items.length) {
        const finished_at = new Date().toISOString();
        await updateSitting(s.id, { position, items, finished_at });
        setSitting(null);
        setJustFinished(true);
        await load();
      } else {
        if (items !== s.items) await updateSitting(s.id, { items, position });
        setSitting({ ...s, items, position });
      }
    },
    [load],
  );

  const onRate = useCallback(
    async (rating: Rating, honesty?: "right" | "wrong") => {
      if (!sitting || !item || !ctx || saving) return;
      setSaving(true);
      try {
        const prev = ctx.states.get(item.card_id) ?? null;
        const at = new Date();
        const next = rate(prev, item.card_id, rating, { now: at, examDate: learner.exam_date, timezone: learner.timezone }, honesty);
        next.first_seen = prev?.first_seen ?? at.toISOString();
        await saveRating({ state: next, rating, mode: item.mode, seconds: seen, sittingId: sitting.id, position: pos + 1 });
        ctx.states.set(item.card_id, next);
        // "Didn't get it": the card comes back once at the end of this sitting if a slot is free.
        let items = sitting.items;
        const slots = items.reduce((n, it) => n + (LONG_TYPES.includes(ctx.metas.get(it.card_id)?.type ?? "fact") ? 2 : 1), 0);
        const already = items.filter((it) => it.card_id === item.card_id).length > 1;
        if (rating === 1 && item.mode !== "honesty" && !already && slots < 10) items = [...items, { card_id: item.card_id, mode: "recall" }];
        await advance(sitting, items);
      } catch (e) {
        setToast(learner.lang === "hi" ? "सहेजा नहीं जा सका — इंटरनेट देखिए और फिर दबाइए।" : "Couldn't save — check your connection and tap again.");
        console.error(e);
      } finally {
        setSaving(false);
      }
    },
    [sitting, item, ctx, saving, learner, seen, pos, advance],
  );

  const onTestFinish = useCallback(
    async (results: TestResult[]) => {
      if (!sitting || !ctx) return;
      setSaving(true);
      try {
        await saveTestAnswers(userId, results.map(({ question_id, chosen, correct }) => ({ question_id, chosen, correct })));
        const wrongCards = [...new Set(results.filter((r) => !r.correct).flatMap((r) => r.covers))].filter((id) => ctx.states.has(id));
        await makeDueNow(wrongCards);
        results.forEach((r) => ctx.answered.add(r.question_id));
        await advance(sitting, sitting.items);
      } catch {
        setToast(learner.lang === "hi" ? "सहेजा नहीं जा सका।" : "Couldn't save the test.");
      } finally {
        setSaving(false);
      }
    },
    [sitting, ctx, userId, advance, learner.lang],
  );

  const askAi = useCallback(
    async (cardId: string) => {
      try {
        const r = await callFunction<{ explain: string; example?: string; key: string }>("upsc-ai", {
          task: "explain_again",
          cardId,
          lang: cardLang,
        });
        return { text: [r.explain, r.example].filter(Boolean).join(" "), key: r.key };
      } catch {
        return null;
      }
    },
    [cardLang],
  );
  const reportAi = useCallback(
    (key: string) => {
      sb().from("ai_flags").insert({ user_id: userId, cache_key: key, reason: "learner report" }).then(() => {});
    },
    [userId],
  );

  // ---------------------------------------------------------------- render
  if (error)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg">{learner.lang === "hi" ? "कुछ गड़बड़ हुई।" : "Something went wrong."}</p>
        <p className="text-sm text-muted">{error}</p>
        <button className="rounded-full bg-ink px-5 py-2 text-paper" onClick={() => (setError(null), load())}>
          {learner.lang === "hi" ? "फिर कोशिश करें" : "Try again"}
        </button>
      </div>
    );
  if (!ctx || !plan) return <div className="flex h-full items-center justify-center text-muted">{L.loading}</div>;

  const progress = { pos: pos + 1, total: sitting?.items.length ?? 0 };
  let body: React.ReactNode;
  if (sitting && item) {
    if (item.mode === "test") {
      const qs = tests.get(item.card_id);
      const topic = ctx.topics.get(item.card_id.slice(5));
      body = qs ? (
        <TestCard
          key={itemKey}
          title={topic ? tx(topic.title, cardLang) : ""}
          questions={qs}
          lang={cardLang}
          progress={progress}
          onToggleLang={() => setCardLang((l) => (l === "en" ? "hi" : "en"))}
          onFinish={onTestFinish}
        />
      ) : null;
    } else {
      const card = payloads.get(item.card_id);
      if (card) {
        const props: CardProps = {
          card,
          mode: item.mode,
          lang: cardLang,
          initialSeconds: stored,
          progress,
          onToggleLang: () => setCardLang((l) => (l === "en" ? "hi" : "en")),
          onDone: onRate,
          askAi,
          reportAi,
        };
        const C =
          card.type === "fact"
            ? FactCard
            : card.type === "steps"
              ? StepsCard
              : card.type === "math" || card.type === "reasoning"
                ? MathCard
                : card.type === "diagram"
                  ? DiagramCard
                  : SummaryCard;
        body = <C key={itemKey} {...props} />;
      }
    }
    if (!body) body = <div className="flex h-full items-center justify-center text-muted">{L.loading}</div>;
  } else {
    body = (
      <BetweenSittings
        lang={learner.lang}
        plan={plan}
        next={next}
        justFinished={justFinished}
        course={ctx.course}
        nextTime={nextStudyTime(now, learner)}
        onStart={(bonus) => start(bonus)}
        onPaid={load}
      />
    );
  }

  return (
    <div className={`study-lock mx-auto flex w-full max-w-2xl flex-col px-3 pb-3 pt-2 sm:px-4 ${saving ? "pointer-events-none" : ""}`}>
      <FeedHeader
        lang={learner.lang}
        done={plan.doneToday}
        quota={plan.quota}
        minutesLeft={plan.minutesLeft}
        daysLeft={plan.daysLeft}
        streak={streak}
        nextLabel={
          next?.status === "at" && next.time ? clock(next.time, learner.lang) : null
        }
        onProfile={() => setProfileOpen(true)}
      />
      <div className="min-h-0 flex-1">{body}</div>
      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-30 mx-auto w-fit max-w-[90vw] rounded-full bg-ink px-5 py-2 text-sm text-paper shadow-lg">
          {toast}
        </div>
      )}
      {profileOpen && (
        <ProfileSheet
          userId={userId}
          learner={learner}
          course={ctx.course}
          onClose={() => setProfileOpen(false)}
          onSaved={(l) => {
            onLearner(l);
            setToast(t(l.lang).saved);
          }}
        />
      )}
    </div>
  );
}

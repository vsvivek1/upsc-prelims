"use client";
import type { Lang, NextSitting, Plan } from "@/engine";
import type { Course } from "@/lib/data";
import { clock, t } from "@/lib/i18n";
import { UnlockCard } from "./UnlockCard";
import { AlertsBanner } from "./AlertsBanner";
import { WeeklyReportCard } from "./WeeklyReportCard";

/** The calm screen between sittings: progress, when the next one opens, bonus sets, unlock and exam-day notes. */
export function BetweenSittings(props: {
  lang: Lang;
  plan: Plan;
  next: NextSitting | null;
  justFinished: boolean;
  course: Course;
  nextTime: { time: string; tomorrow: boolean } | null;
  onStart: (bonus: boolean) => void;
  onPaid: () => void;
  onReviewWeek: (cardIds: string[]) => void;
}) {
  const { lang, plan, next } = props;
  const L = t(lang);

  if (plan.phase === "after")
    return (
      <Panel>
        <p className="font-display text-3xl">{L.afterExam}</p>
      </Panel>
    );

  const head = props.justFinished ? (
    <div className="space-y-1">
      <p className="text-sm font-semibold uppercase tracking-wide text-leaf">{L.sittingDone}</p>
      <p className="font-display text-4xl tabular-nums">
        {L.today} {plan.doneToday}/{plan.quota}
      </p>
    </div>
  ) : null;

  const unlock = plan.outOfFreeCards ? <UnlockCard lang={lang} course={props.course} onPaid={props.onPaid} /> : null;

  let main: React.ReactNode;
  if (plan.left > 0 && next && !next.bonus) {
    main =
      next.status === "now" ? (
        <button onClick={() => props.onStart(false)} className="w-full rounded-2xl bg-ink px-5 py-4 text-lg font-semibold text-paper">
          {L.startSitting}
        </button>
      ) : next.status === "at" && next.time ? (
        <p className="font-display text-2xl">{L.nextSittingAt(clock(next.time, lang))}</p>
      ) : props.nextTime ? (
        <p className="font-display text-2xl">{L.nextSittingTomorrow(clock(props.nextTime.time, lang))}</p>
      ) : null;
  } else if (!plan.outOfFreeCards || plan.left === 0) {
    main = (
      <div className="space-y-4">
        <p className="font-display text-3xl text-leaf">{L.quotaComplete} ✓</p>
        <WeeklyReportCard lang={lang} onReview={props.onReviewWeek} />
        {next?.status === "now" && next.bonus && (
          <>
            <p className="text-lg">{L.bonusNow}</p>
            <button onClick={() => props.onStart(true)} className="rounded-2xl border-2 border-ink px-5 py-3 font-semibold">
              {L.startBonus}
            </button>
          </>
        )}
        {next?.status === "at" && next.time && <p className="text-lg">{L.bonusAt(clock(next.time, lang))}</p>}
        {next?.status === "tomorrow" && <p className="text-lg text-muted">{plan.phase === "cram" ? L.sleepNow : L.restNow}</p>}
      </div>
    );
  }

  return (
    <Panel>
      <div className="space-y-6">
        {head}
        {plan.phase === "cram" && <Note>{L.cram}</Note>}
        {plan.phase === "exam_day" && (
          <Note>
            <p className="font-semibold">{L.examDay}</p>
            <ul className="mt-2 list-inside list-disc">
              {L.examChecklist.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Note>
        )}
        {plan.behindPlan && <Note>{L.behind}</Note>}
        {unlock}
        {main}
        <AlertsBanner lang={lang} />
      </div>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="fade-up flex h-full flex-col justify-center overflow-y-auto rounded-3xl border border-line bg-card p-6 sm:p-10">{children}</div>;
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-saffron-soft/70 p-4 text-ink">{children}</div>;
}

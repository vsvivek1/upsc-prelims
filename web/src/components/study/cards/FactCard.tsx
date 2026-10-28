"use client";
import { useState } from "react";
import { minSeconds, RECALL_THINK_SECONDS, words, type Rating } from "@/engine";
import { tx, type FactPayload } from "@/lib/content";
import { t } from "@/lib/i18n";
import { CardFrame, type Screen } from "../CardFrame";
import { AiHelp } from "../AiHelp";
import type { CardProps } from "./types";

/** fact: learn view on first showing; recall view (question → reveal) later; honesty check view. */
export function FactCard(props: CardProps) {
  const { card, mode, lang } = props;
  const p = card.payload as FactPayload;
  const L = t(lang);
  const [step, setStep] = useState<"main" | "think" | "answer" | "simple">(mode === "learn" ? "main" : "think");
  const [pending, setPending] = useState<Rating | null>(null);

  const learn = tx(p.learn, lang);
  const why = tx(p.why, lang);
  const example = tx(p.example, lang);
  const rq = tx(p.recall_q, lang);
  const ra = tx(p.recall_a, lang);
  const simple = tx(p.explain_simple, lang);

  const rateFromLearn = (r: Rating) => {
    if (r === 1) {
      // Didn't get it: say it a second way first, then move on.
      setPending(1);
      setStep("simple");
    } else props.onDone(r);
  };

  let screen: Screen;
  if (step === "simple") {
    screen = {
      key: `${card.id}-simple`,
      min: minSeconds("explain", words(simple), lang),
      speak: simple,
      body: (
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-saffron">{L.explainSimple}</p>
          <p className="text-xl leading-relaxed sm:text-2xl">{simple}</p>
          <AiHelp {...props} />
        </div>
      ),
      action: { kind: "next" },
    };
  } else if (step === "main") {
    screen = {
      key: `${card.id}-learn`,
      min: minSeconds("fact_learn", words(learn, why, example), lang, p.min_seconds),
      speak: [learn, why, example].filter(Boolean).join(". "),
      body: (
        <div className="space-y-5">
          <p className="font-display text-2xl leading-snug sm:text-3xl">{learn}</p>
          <div className="rounded-2xl bg-paper p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{L.why}</p>
            <p className="mt-1 text-lg leading-relaxed">{why}</p>
          </div>
          {example && (
            <div className="rounded-2xl border border-dashed border-line p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{L.example}</p>
              <p className="mt-1 text-lg leading-relaxed">{example}</p>
            </div>
          )}
        </div>
      ),
      action: { kind: "rate" },
    };
  } else if (step === "think") {
    screen = {
      key: `${card.id}-think`,
      min: RECALL_THINK_SECONDS,
      speak: rq,
      body: (
        <div className="flex h-full flex-col justify-center space-y-4">
          {mode === "honesty" && <p className="text-sm font-semibold text-saffron">{L.honestyQ}</p>}
          <p className="font-display text-2xl leading-snug sm:text-3xl">{rq}</p>
          <p className="text-muted">{L.thinkFirst}</p>
        </div>
      ),
      action: { kind: "next", label: L.showAnswer },
    };
  } else {
    screen = {
      key: `${card.id}-answer`,
      min: minSeconds("fact_recall", words(ra, why), lang),
      speak: `${ra}. ${why}`,
      body: (
        <div className="space-y-5">
          <p className="text-lg text-muted">{rq}</p>
          <p className="font-display text-2xl leading-snug text-leaf sm:text-3xl">{ra}</p>
          <div className="rounded-2xl bg-paper p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{L.why}</p>
            <p className="mt-1 text-lg leading-relaxed">{why}</p>
          </div>
        </div>
      ),
      action:
        mode === "honesty"
          ? {
              kind: "choices",
              buttons: [
                { label: L.rememberedNo, tone: "bad", onPick: () => props.onDone(1, "wrong") },
                { label: L.rememberedYes, tone: "good", onPick: () => props.onDone(4, "right") },
              ],
            }
          : { kind: "rate" },
    };
  }

  return (
    <CardFrame
      screen={screen}
      lang={lang}
      initialSeconds={step === "main" || step === "think" ? props.initialSeconds : 0}
      progress={props.progress}
      onToggleLang={props.onToggleLang}
      onNext={() => {
        if (step === "think") setStep("answer");
        else if (step === "simple") props.onDone(pending ?? 1);
      }}
      onRate={(r) => (step === "main" ? rateFromLearn(r) : r === 1 ? (setPending(1), setStep("simple")) : props.onDone(r))}
    />
  );
}

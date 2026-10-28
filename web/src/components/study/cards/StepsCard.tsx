"use client";
import { useState } from "react";
import { minSeconds, words, RECALL_THINK_SECONDS } from "@/engine";
import { tx, type StepsPayload } from "@/lib/content";
import { t } from "@/lib/i18n";
import { CardFrame, type Screen } from "../CardFrame";
import { AiHelp } from "../AiHelp";
import type { CardProps } from "./types";

/** steps: intro → one step per screen (Explain / Next step) → summary → recall → rate. Review: recall → summary → rate. */
export function StepsCard(props: CardProps) {
  const { card, mode, lang } = props;
  const p = card.payload as StepsPayload;
  const L = t(lang);
  const n = p.steps.length;
  // Screen order. Learn: intro, steps 0..n-1, summary, recall, answer. Review: recall, answer (with summary).
  const learnOrder = ["intro", ...p.steps.map((_, i) => `s${i}`), "summary", "recall", "answer"];
  const order = mode === "learn" ? learnOrder : ["recall", "answer"];
  const [idx, setIdx] = useState(0);
  const [explained, setExplained] = useState<Record<number, number>>({});
  const at = order[idx];

  const summaryList = (
    <ul className="space-y-3">
      {p.summary.map((pt, i) => (
        <li key={i} className="flex gap-3 text-lg leading-relaxed">
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-saffron" />
          {tx(pt, lang)}
        </li>
      ))}
    </ul>
  );

  let screen: Screen;
  if (at === "intro") {
    const mins = Math.max(1, Math.round(p.steps.reduce((s, x) => s + minSeconds("step", words(tx(x.text, lang)), lang), 0) / 60));
    screen = {
      key: `${card.id}-intro`,
      min: 3,
      speak: tx(p.title, lang),
      body: (
        <div className="flex h-full flex-col justify-center gap-3">
          <p className="font-display text-3xl">{tx(p.title, lang)}</p>
          <p className="text-muted">
            {n} {lang === "hi" ? "चरण" : "steps"} · {lang === "hi" ? `लगभग ${mins} मिनट` : `about ${mins} min`}
          </p>
        </div>
      ),
      action: { kind: "next" },
    };
  } else if (at.startsWith("s")) {
    const i = Number(at.slice(1));
    const st = p.steps[i];
    const text = tx(st.text, lang);
    const exp = tx(st.explain, lang);
    const times = explained[i] ?? 0;
    screen = {
      key: `${card.id}-${at}`,
      min: minSeconds("step", words(text), lang, st.min_seconds) + (times > 0 ? minSeconds("explain", words(exp), lang) : 0),
      speak: times > 0 && exp ? `${text}. ${exp}` : text,
      body: (
        <div className="space-y-4">
          <div className="flex gap-1.5">
            {p.steps.map((_, j) => (
              <span key={j} className={`h-1.5 flex-1 rounded-full ${j <= i ? "bg-saffron" : "bg-line"}`} />
            ))}
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {L.step} {i + 1} {L.of} {n}
          </p>
          <p className="text-xl leading-relaxed sm:text-2xl">{text}</p>
          {times > 0 && exp && <p className="rounded-2xl bg-paper p-4 text-lg leading-relaxed">{exp}</p>}
          {(times > 1 || (times > 0 && !exp)) && <AiHelp {...props} />}
        </div>
      ),
      action: { kind: "next", label: L.nextStep },
      side: { label: L.explain, onClick: () => setExplained((e) => ({ ...e, [i]: (e[i] ?? 0) + 1 })) },
    };
  } else if (at === "summary") {
    screen = {
      key: `${card.id}-summary`,
      min: minSeconds("summary", words(...p.summary.map((x) => tx(x, lang))), lang),
      speak: p.summary.map((x) => tx(x, lang)).join(". "),
      body: (
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-saffron">{L.summary}</p>
          {summaryList}
        </div>
      ),
      action: { kind: "next" },
    };
  } else if (at === "recall") {
    screen = {
      key: `${card.id}-recall`,
      min: RECALL_THINK_SECONDS,
      speak: tx(p.recall_q, lang),
      body: (
        <div className="flex h-full flex-col justify-center gap-4">
          {mode !== "learn" && <p className="text-sm font-semibold text-muted">{tx(p.title, lang)}</p>}
          <p className="font-display text-2xl leading-snug sm:text-3xl">{tx(p.recall_q, lang)}</p>
          <p className="text-muted">{L.thinkFirst}</p>
        </div>
      ),
      action: { kind: "next", label: L.showAnswer },
    };
  } else {
    screen = {
      key: `${card.id}-answer`,
      min: minSeconds("fact_recall", words(tx(p.recall_a, lang)), lang),
      speak: tx(p.recall_a, lang),
      body: (
        <div className="space-y-5">
          <p className="font-display text-2xl text-leaf">{tx(p.recall_a, lang)}</p>
          {mode !== "learn" && summaryList}
        </div>
      ),
      action: { kind: "rate" },
    };
  }

  return (
    <CardFrame
      screen={screen}
      lang={lang}
      initialSeconds={idx === 0 ? props.initialSeconds : 0}
      progress={props.progress}
      onToggleLang={props.onToggleLang}
      onNext={() => setIdx((i) => Math.min(i + 1, order.length - 1))}
      onRate={(r) => props.onDone(r)}
    />
  );
}

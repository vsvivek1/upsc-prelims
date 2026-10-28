"use client";
import { useMemo, useState } from "react";
import { minSeconds, words } from "@/engine";
import { tx, type MathPayload } from "@/lib/content";
import { t } from "@/lib/i18n";
import { CardFrame, type Screen } from "../CardFrame";
import type { CardProps } from "./types";

const PAPER_SECONDS = 60;

/** math and reasoning: exam question → split → rule → worked steps → answer → your turn on paper → rate. */
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-muted">{children}</p>;
}

export function MathCard(props: CardProps) {
  const { card, mode, lang } = props;
  const p = card.payload as MathPayload;
  const L = t(lang);
  // Rotate practice questions on reviews.
  const [practiceIdx] = useState(() => Math.floor(Date.now() / 86_400_000) % p.practice.length);
  const practice = p.practice[practiceIdx] ?? p.practice[0];

  const order = useMemo(() => {
    const work = p.steps.map((_, i) => `w${i}`);
    const pr = ["pq", ...practice.steps.map((_, i) => `ps${i}`), "pa"];
    return mode === "learn" ? ["exam", "split", "theory", ...work, "answer", ...pr] : pr;
  }, [mode, p.steps, practice]);
  const [idx, setIdx] = useState(0);
  const at = order[idx];
  const last = idx === order.length - 1;

  const examBox = (
    <div className="rounded-2xl bg-paper p-4">
      <p className="text-lg leading-relaxed">{tx(p.exam_q, lang)}</p>
    </div>
  );

  let screen: Screen;
  if (at === "exam") {
    screen = {
      key: `${card.id}-exam`,
      min: minSeconds("math_step", words(tx(p.exam_q, lang)), lang),
      speak: tx(p.exam_q, lang),
      body: (
        <div className="space-y-4">
          <span className="inline-block rounded-full bg-saffron-soft px-3 py-1 text-xs font-semibold text-saffron">
            {tx(p.exam_note, lang) || (lang === "hi" ? "ऐसा प्रश्न परीक्षा में आ सकता है" : "A question like this can come in the exam")}
          </span>
          <p className="font-display text-2xl leading-snug">{tx(p.exam_q, lang)}</p>
        </div>
      ),
      action: { kind: "next" },
    };
  } else if (at === "split") {
    const rows = [
      [L.given, tx(p.split.given, lang)],
      [L.find, tx(p.split.find, lang)],
      [L.idea, tx(p.split.idea, lang)],
    ];
    screen = {
      key: `${card.id}-split`,
      min: minSeconds("math_step", words(...rows.map((r) => r[1])), lang),
      speak: rows.map((r) => `${r[0]}: ${r[1]}`).join(". "),
      body: (
        <div className="space-y-4">
          {examBox}
          {rows.map(([k, v]) => (
            <div key={k}>
              <Label>{k}</Label>
              <p className="text-lg leading-relaxed">{v}</p>
            </div>
          ))}
        </div>
      ),
      action: { kind: "next" },
    };
  } else if (at === "theory") {
    screen = {
      key: `${card.id}-theory`,
      min: minSeconds("math_step", words(tx(p.theory, lang)), lang),
      speak: tx(p.theory, lang),
      body: (
        <div className="space-y-3">
          <Label>{L.theory}</Label>
          <p className="text-xl leading-relaxed">{tx(p.theory, lang)}</p>
        </div>
      ),
      action: { kind: "next" },
    };
  } else if (at.startsWith("w")) {
    const i = Number(at.slice(1));
    const s = p.steps[i];
    screen = {
      key: `${card.id}-${at}`,
      min: minSeconds("math_step", words(tx(s.work, lang), tx(s.why, lang)), lang, s.min_seconds),
      speak: `${tx(s.work, lang)}. ${tx(s.why, lang)}`,
      body: (
        <div className="space-y-4">
          {examBox}
          <Label>
            {L.step} {i + 1} {L.of} {p.steps.length}
          </Label>
          {p.steps.slice(0, i).map((prev, j) => (
            <p key={j} className="font-mono text-base text-muted">
              {tx(prev.work, lang)}
            </p>
          ))}
          <p className="font-mono text-xl font-semibold">{tx(s.work, lang)}</p>
          <p className="text-lg leading-relaxed text-ink-soft">{tx(s.why, lang)}</p>
        </div>
      ),
      action: { kind: "next", label: L.nextStep },
    };
  } else if (at === "answer") {
    screen = {
      key: `${card.id}-answer`,
      min: 3,
      speak: tx(p.answer, lang),
      body: (
        <div className="space-y-4">
          {examBox}
          <div className="rounded-2xl border-2 border-leaf bg-leaf-soft p-4">
            <Label>{L.answer}</Label>
            <p className="text-xl font-semibold">{tx(p.answer, lang)}</p>
          </div>
        </div>
      ),
      action: { kind: "next" },
    };
  } else if (at === "pq") {
    screen = {
      key: `${card.id}-pq`,
      min: PAPER_SECONDS,
      speak: tx(practice.q, lang),
      body: (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-saffron">{L.yourTurn}</p>
          <p className="font-display text-2xl leading-snug">{tx(practice.q, lang)}</p>
          <p className="text-muted">{lang === "hi" ? "काग़ज़ और पेन लीजिए।" : "Take paper and a pen."}</p>
        </div>
      ),
      action: { kind: "next", label: L.showSteps },
    };
  } else if (at.startsWith("ps")) {
    const i = Number(at.slice(2));
    screen = {
      key: `${card.id}-${at}`,
      min: minSeconds("step", words(tx(practice.steps[i], lang)), lang),
      speak: tx(practice.steps[i], lang),
      body: (
        <div className="space-y-3">
          <p className="text-lg text-muted">{tx(practice.q, lang)}</p>
          {practice.steps.slice(0, i + 1).map((st, j) => (
            <p key={j} className={`font-mono ${j === i ? "text-xl font-semibold" : "text-base text-muted"}`}>
              {tx(st, lang)}
            </p>
          ))}
        </div>
      ),
      action: { kind: "next", label: L.nextStep },
    };
  } else {
    screen = {
      key: `${card.id}-pa`,
      min: 3,
      speak: tx(practice.answer, lang),
      body: (
        <div className="space-y-4">
          <p className="text-lg text-muted">{tx(practice.q, lang)}</p>
          <div className="rounded-2xl border-2 border-leaf bg-leaf-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{L.answer}</p>
            <p className="text-xl font-semibold">{tx(practice.answer, lang)}</p>
          </div>
        </div>
      ),
      action: { kind: "rate" },
    };
  }
  if (last && screen.action.kind !== "rate") screen = { ...screen, action: { kind: "rate" } };

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

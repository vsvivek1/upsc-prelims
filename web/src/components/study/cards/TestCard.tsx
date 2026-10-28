"use client";
import { useState } from "react";
import type { Lang } from "@/engine";
import { tx, type QuestionRow } from "@/lib/content";
import { t } from "@/lib/i18n";
import { CardFrame, type Screen } from "../CardFrame";

export interface TestResult {
  question_id: string;
  chosen: number;
  correct: boolean;
  covers: string[];
}

interface Props {
  title: string;
  questions: QuestionRow[];
  lang: Lang;
  progress: { pos: number; total: number };
  onToggleLang: () => void;
  onFinish: (results: TestResult[]) => void;
}

/** Topic test: one question per screen, feedback after each, then the score. */
export function TestCard({ title, questions, lang, progress, onToggleLang, onFinish }: Props) {
  const L = t(lang);
  const [idx, setIdx] = useState(-1); // -1 intro, questions.length = score
  const [chosen, setChosen] = useState<number | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);

  let screen: Screen;
  if (idx === -1) {
    screen = {
      key: "test-intro",
      min: 3,
      body: (
        <div className="flex h-full flex-col justify-center gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-saffron">{lang === "hi" ? "टेस्ट" : "Test"}</p>
          <p className="font-display text-3xl">{title}</p>
          <p className="text-muted">{L.testIntro(questions.length)}</p>
          <p className="text-sm text-muted">{L.testNegative}</p>
        </div>
      ),
      action: { kind: "next" },
    };
  } else if (idx < questions.length) {
    const q = questions[idx];
    const p = q.payload;
    const answered = chosen !== null;
    screen = {
      key: `test-${q.id}-${answered ? "a" : "q"}`,
      min: answered ? 4 : 0,
      speak: tx(p.q, lang),
      body: (
        <div className="space-y-4">
          <p className="text-xs text-muted">
            {idx + 1} / {questions.length}
          </p>
          <p className="whitespace-pre-line text-xl leading-relaxed">{tx(p.q, lang)}</p>
          <div className="grid gap-2">
            {p.options.map((o, i) => {
              const tone = !answered
                ? "border-line bg-paper hover:border-ink"
                : i === p.answer
                  ? "border-leaf bg-leaf-soft"
                  : i === chosen
                    ? "border-rose bg-rose-soft"
                    : "border-line bg-paper opacity-60";
              return (
                <button
                  key={i}
                  disabled={answered}
                  onClick={() => {
                    setChosen(i);
                    setResults((r) => [...r, { question_id: q.id, chosen: i, correct: i === p.answer, covers: q.covers }]);
                  }}
                  className={`rounded-2xl border-2 px-4 py-3 text-left text-lg ${tone}`}
                >
                  <span className="mr-2 font-semibold">{"abcd"[i]})</span>
                  {tx(o, lang)}
                </button>
              );
            })}
          </div>
          {answered && (
            <div className={`rounded-2xl p-4 ${chosen === p.answer ? "bg-leaf-soft" : "bg-rose-soft"}`}>
              <p className="font-semibold">{chosen === p.answer ? L.correct : L.wrong}</p>
              <p className="mt-1 leading-relaxed">{tx(p.explain, lang)}</p>
            </div>
          )}
        </div>
      ),
      action: answered ? { kind: "next", label: L.continue } : { kind: "none" },
    };
  } else {
    const right = results.filter((r) => r.correct).length;
    screen = {
      key: "test-score",
      min: 3,
      body: (
        <div className="flex h-full flex-col justify-center gap-3">
          <p className="font-display text-4xl">{L.score(right, results.length)}</p>
          {right < results.length && <p className="text-lg text-muted">{L.willReturn}</p>}
        </div>
      ),
      action: { kind: "next", label: L.continue },
    };
  }

  return (
    <CardFrame
      screen={screen}
      lang={lang}
      progress={progress}
      onToggleLang={onToggleLang}
      onRate={() => {}}
      onNext={() => {
        if (idx >= questions.length) onFinish(results);
        else {
          setChosen(null);
          setIdx((i) => i + 1);
        }
      }}
    />
  );
}

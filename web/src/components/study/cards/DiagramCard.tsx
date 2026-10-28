"use client";
import { useState } from "react";
import { tx, type DiagramPayload } from "@/lib/content";
import { t } from "@/lib/i18n";
import type { Lang } from "@/engine";
import { CardFrame, type Screen } from "../CardFrame";
import type { CardProps } from "./types";

/** Draws steps 0..upto; step `active` animates its strokes, earlier steps stay faint. */
function Drawing({ p, upto, active, lang, big }: { p: DiagramPayload; upto: number; active: number | null; lang: Lang; big?: boolean }) {
  return (
    <svg viewBox={`0 0 ${p.canvas.w} ${p.canvas.h}`} className={`mx-auto w-full ${big ? "max-h-[55vh]" : "max-h-[38vh]"}`} role="img">
      {p.steps.slice(0, upto + 1).map((s, i) => (
        <g key={i} opacity={active === null || i === active ? 1 : 0.35}>
          {(s.paths ?? []).map((d, j) => (
            <path
              key={`${i}-${j}-${active}`}
              d={d}
              fill="none"
              stroke="#1c2140"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={i === active ? 1 : 0}
              style={i === active ? { animation: `draw 1.6s ease-out ${j * 0.4}s forwards` } : undefined}
            />
          ))}
          {(s.labels ?? []).map((lb, j) => (
            <text key={j} x={lb.x} y={lb.y} fontSize={11} textAnchor="middle" fill="#e07a1f" fontWeight={600}>
              {tx(lb.text, lang)}
            </text>
          ))}
        </g>
      ))}
    </svg>
  );
}

export function DiagramCard(props: CardProps) {
  const { card, mode, lang } = props;
  const p = card.payload as DiagramPayload;
  const L = t(lang);
  const n = p.steps.length;
  const order = mode === "learn" ? ["ready", ...p.steps.map((_, i) => `b${i}`), "compare"] : ["memory", "replay"];
  const [idx, setIdx] = useState(0);
  const at = order[idx];

  let screen: Screen;
  if (at === "ready") {
    screen = {
      key: `${card.id}-ready`,
      min: 4,
      speak: tx(p.title, lang),
      body: (
        <div className="space-y-3">
          <p className="font-display text-2xl">{tx(p.title, lang)}</p>
          <p className="text-muted">{lang === "hi" ? "आज आप यह बनाएँगे। काग़ज़ और पेंसिल तैयार रखिए।" : "Today you'll draw this. Keep paper and a pencil ready."}</p>
          <Drawing p={p} upto={n - 1} active={null} lang={lang} />
        </div>
      ),
      action: { kind: "next" },
    };
  } else if (at.startsWith("b")) {
    const i = Number(at.slice(1));
    const s = p.steps[i];
    screen = {
      key: `${card.id}-${at}`,
      min: s.min_seconds ?? 20,
      speak: tx(s.say, lang),
      body: (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {L.step} {i + 1} {L.of} {n}
          </p>
          <p className="text-xl leading-relaxed">{tx(s.say, lang)}</p>
          <Drawing p={p} upto={i} active={i} lang={lang} />
          <p className="text-sm text-muted">{L.drawOnPaper}</p>
        </div>
      ),
      action: { kind: "next", label: L.iDrewIt },
    };
  } else if (at === "compare") {
    screen = {
      key: `${card.id}-compare`,
      min: 6,
      speak: p.key_parts.map((k) => tx(k, lang)).join(", "),
      body: (
        <div className="space-y-3">
          <p className="font-display text-2xl">{L.compare}</p>
          <Drawing p={p} upto={n - 1} active={null} lang={lang} big />
          <p className="text-sm text-muted">{p.key_parts.map((k) => tx(k, lang)).join(" · ")}</p>
        </div>
      ),
      action: { kind: "rate" },
    };
  } else if (at === "memory") {
    screen = {
      key: `${card.id}-memory`,
      min: 60,
      speak: tx(p.recall_prompt, lang),
      body: (
        <div className="flex h-full flex-col justify-center gap-4">
          <p className="text-sm font-semibold text-saffron">{L.drawFromMemory}</p>
          <p className="font-display text-2xl leading-snug">{tx(p.recall_prompt, lang)}</p>
        </div>
      ),
      action: { kind: "next", label: L.showAnswer },
    };
  } else {
    screen = {
      key: `${card.id}-replay`,
      min: 5,
      body: (
        <div className="space-y-3">
          <p className="font-display text-2xl">{L.compare}</p>
          <Drawing p={p} upto={n - 1} active={null} lang={lang} big />
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

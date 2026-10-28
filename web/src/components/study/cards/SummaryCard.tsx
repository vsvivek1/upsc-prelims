"use client";
import { minSeconds, words } from "@/engine";
import { tx, type SummaryPayload } from "@/lib/content";
import { t } from "@/lib/i18n";
import { CardFrame } from "../CardFrame";
import type { CardProps } from "./types";

/** summary: 2–5 short points for a topic (end of topic, revision, cram). */
export function SummaryCard(props: CardProps) {
  const { card, lang } = props;
  const p = card.payload as SummaryPayload;
  const L = t(lang);
  const pts = p.points.map((x) => tx(x, lang));
  return (
    <CardFrame
      screen={{
        key: `${card.id}-sum`,
        min: minSeconds("summary", words(...pts), lang, p.min_seconds),
        speak: `${tx(p.title, lang)}. ${pts.join(". ")}`,
        body: (
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-saffron">{L.summary}</p>
            <p className="font-display text-2xl">{tx(p.title, lang)}</p>
            <ul className="space-y-3">
              {pts.map((pt, i) => (
                <li key={i} className="flex gap-3 text-lg leading-relaxed">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-saffron" />
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        ),
        action: { kind: "rate" },
      }}
      lang={lang}
      initialSeconds={props.initialSeconds}
      progress={props.progress}
      onToggleLang={props.onToggleLang}
      onNext={() => {}}
      onRate={(r) => props.onDone(r)}
    />
  );
}

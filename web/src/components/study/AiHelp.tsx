"use client";
import { useState } from "react";
import { t } from "@/lib/i18n";
import type { CardProps } from "./cards/types";

/** "Explain it differently": AI text through the server, with a Report button. Falls back quietly offline. */
export function AiHelp({ card, lang, askAi, reportAi }: Pick<CardProps, "card" | "lang" | "askAi" | "reportAi">) {
  const L = t(lang);
  const [state, setState] = useState<"idle" | "loading" | "done" | "reported">("idle");
  const [text, setText] = useState("");
  const [key, setKey] = useState("");
  if (!askAi) return null;

  if (state === "idle")
    return (
      <button
        className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft"
        onClick={async () => {
          setState("loading");
          const r = await askAi(card.id).catch(() => null);
          setText(r?.text ?? L.aiFallback);
          setKey(r?.key ?? "");
          setState("done");
        }}
      >
        {L.aiMore}
      </button>
    );
  if (state === "loading") return <p className="text-sm text-muted">{L.loading}</p>;
  return (
    <div className="rounded-2xl bg-saffron-soft/60 p-4">
      <p className="text-lg leading-relaxed">{text}</p>
      {key && reportAi && (
        <button
          className="mt-2 text-xs text-muted underline"
          disabled={state === "reported"}
          onClick={() => {
            reportAi(key);
            setState("reported");
          }}
        >
          {state === "reported" ? L.aiReported : L.aiReport}
        </button>
      )}
    </div>
  );
}

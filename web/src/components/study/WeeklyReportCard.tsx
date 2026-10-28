"use client";
import { useEffect, useState } from "react";
import type { Lang } from "@/engine";
import { loadLatestReport } from "@/lib/data";
import { t } from "@/lib/i18n";

type Topic = { topic: string; title: { en: string; hi: string }; cards: number };
type ReportData = {
  days_studied: number;
  cards_rated: number;
  minutes: number;
  became_easy: Topic[];
  still_tough: Topic[];
  review_cards: string[];
};

const KEY = "algo-upsc-report-seen";

/** The weekly report as a card: shown after the day's quota, once per report, never inside a sitting. */
export function WeeklyReportCard({ lang, onReview }: { lang: Lang; onReview: (cardIds: string[]) => void }) {
  const [report, setReport] = useState<{ id: number; week_start: string; data: ReportData } | null>(null);
  const L = t(lang);

  useEffect(() => {
    loadLatestReport()
      .then((r) => {
        if (!r) return;
        const ageDays = (Date.now() - new Date(r.week_start).getTime()) / 86_400_000;
        let seen: string | null = null;
        try {
          seen = localStorage.getItem(KEY);
        } catch {}
        if (ageDays <= 9 && seen !== String(r.id)) setReport(r as unknown as { id: number; week_start: string; data: ReportData });
      })
      .catch(() => {});
  }, []);

  if (!report) return null;
  const d = report.data;
  const close = () => {
    try {
      localStorage.setItem(KEY, String(report.id));
    } catch {}
    setReport(null);
  };
  const name = (x: Topic) => x.title[lang] ?? x.title.en;

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-paper p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-saffron">{L.weekReport}</p>
      <p className="font-display text-2xl">{L.daysStudied(d.days_studied)}</p>
      <p className="text-muted">{L.weekNumbers(d.cards_rated, d.minutes)}</p>
      {d.became_easy.length > 0 && (
        <div>
          <p className="font-semibold text-leaf">{L.becameEasy}</p>
          <p>{d.became_easy.slice(0, 3).map(name).join(" · ")}</p>
        </div>
      )}
      {d.still_tough.length > 0 && (
        <div>
          <p className="font-semibold text-rose">{L.stillTough}</p>
          <p>{d.still_tough.slice(0, 3).map(name).join(" · ")}</p>
        </div>
      )}
      {d.became_easy[0] && (
        <p className="rounded-xl bg-saffron-soft/70 p-3">
          {L.teachBack}: <b>{name(d.became_easy[0])}</b>
        </p>
      )}
      <div className="flex flex-wrap gap-3 pt-1">
        {d.review_cards.length > 0 && (
          <button
            onClick={() => {
              close();
              onReview(d.review_cards.slice(0, 5));
            }}
            className="rounded-2xl bg-ink px-4 py-2 font-semibold text-paper"
          >
            {L.reviewWeek}
          </button>
        )}
        <button onClick={close} className="rounded-2xl border border-line px-4 py-2">
          {L.gotIt}
        </button>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import type { Lang } from "@/engine";
import { saveLearner, type Course, type Learner } from "@/lib/data";
import { t } from "@/lib/i18n";
import { enablePush } from "@/lib/push";

const CHIPS: { key: "morning" | "afternoon" | "evening" | "night"; time: string }[] = [
  { key: "morning", time: "07:00" },
  { key: "afternoon", time: "13:30" },
  { key: "evening", time: "19:00" },
  { key: "night", time: "21:00" },
];

/** Once, at most six short screens. Then the first sitting starts at once. */
export function Onboarding({
  userId,
  email,
  name,
  course,
  onDone,
}: {
  userId: string;
  email: string | null;
  name: string | null;
  course: Course | null;
  onDone: (l: Learner) => void;
}) {
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<Lang>("en");
  const [examDate, setExamDate] = useState(course?.exam_date ?? "2027-05-23");
  const [times, setTimes] = useState<string[]>(["07:00", "13:30", "19:00"]);
  const [minutes, setMinutes] = useState(30);
  const [reportOn, setReportOn] = useState(true);
  const [reportEmail, setReportEmail] = useState(email ?? "");
  const [busy, setBusy] = useState(false);
  const L = t(lang);
  const O = L.onboarding;

  async function finish() {
    setBusy(true);
    try {
      const l = await saveLearner(userId, {
        name,
        lang,
        exam_date: examDate,
        study_times: [...times].sort(),
        minutes_per_day: minutes,
        report_opt_in: reportOn,
        report_email: reportOn ? reportEmail || email : null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
        onboarded_at: new Date().toISOString(),
      });
      onDone(l);
    } finally {
      setBusy(false);
    }
  }

  const screens = [
    <Q key="lang" title={`${t("en").onboarding.lang} · ${t("hi").onboarding.lang}`}>
      <div className="grid gap-3">
        {(["en", "hi"] as Lang[]).map((l) => (
          <button key={l} onClick={() => setLang(l)} className={`rounded-2xl border-2 px-5 py-4 text-xl ${lang === l ? "border-ink bg-ink text-paper" : "border-line"}`}>
            {l === "en" ? "English" : "हिन्दी"}
          </button>
        ))}
      </div>
    </Q>,
    <Q key="exam" title={O.examTitle} hint={O.examHint}>
      <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-xl" />
      <p className="text-sm text-muted">
        {L.examSource}: {course?.exam_name ?? "UPSC CSE (Prelims) 2027"} — 23 May 2027, UPSC Calendar 2027 ({lang === "hi" ? "आधिकारिक" : "official"})
      </p>
    </Q>,
    <Q key="times" title={O.timesTitle} hint={O.timesHint}>
      <div className="grid grid-cols-2 gap-2">
        {CHIPS.map((c) => {
          const on = times.includes(c.time);
          return (
            <button
              key={c.key}
              onClick={() => setTimes((ts) => (on ? ts.filter((x) => x !== c.time) : ts.length < 4 ? [...ts, c.time] : ts))}
              className={`rounded-2xl border-2 px-4 py-3 text-left ${on ? "border-ink bg-ink text-paper" : "border-line"}`}
            >
              <span className="block font-semibold">{O[c.key]}</span>
              <span className="text-sm opacity-80">{c.time}</span>
            </button>
          );
        })}
      </div>
    </Q>,
    <Q key="mins" title={O.minutesTitle}>
      <div className="grid grid-cols-3 gap-2">
        {[15, 30, 45, 60, 90, 120].map((m) => (
          <button key={m} onClick={() => setMinutes(m)} className={`rounded-2xl border-2 px-4 py-3 text-lg ${minutes === m ? "border-ink bg-ink text-paper" : "border-line"}`}>
            {m}
          </button>
        ))}
      </div>
    </Q>,
    <Q key="report" title={O.reportTitle} hint={O.reportHint}>
      <label className="flex items-center gap-3 text-lg">
        <input type="checkbox" checked={reportOn} onChange={(e) => setReportOn(e.target.checked)} className="h-5 w-5" />
        {L.weeklyReport}
      </label>
      {reportOn && (
        <input type="email" value={reportEmail} onChange={(e) => setReportEmail(e.target.value)} className="w-full rounded-2xl border border-line bg-paper px-4 py-3" />
      )}
    </Q>,
    <Q key="alerts" title={O.alertsTitle} hint={O.alertsHint}>
      <button
        onClick={async () => {
          await enablePush().catch(() => null);
          finish();
        }}
        disabled={busy}
        className="w-full rounded-2xl bg-saffron px-5 py-4 text-lg font-semibold text-ink"
      >
        🔔 {O.turnOn}
      </button>
      <button onClick={finish} disabled={busy} className="w-full rounded-2xl border border-line px-5 py-3">
        {O.later}
      </button>
    </Q>,
  ];

  const last = step === screens.length - 1;
  return (
    <div className={`study-lock mx-auto flex w-full max-w-lg flex-col p-4 ${lang === "hi" ? "lang-hi" : ""}`}>
      <div className="mb-4 flex gap-1.5">
        {screens.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-saffron" : "bg-line"}`} />
        ))}
      </div>
      <div className="fade-up flex-1 overflow-y-auto" key={step}>
        {screens[step]}
      </div>
      {!last && (
        <button
          onClick={() => setStep((s) => s + 1)}
          disabled={step === 2 && times.length === 0}
          className="mt-4 w-full rounded-2xl bg-ink px-5 py-4 text-lg font-semibold text-paper disabled:opacity-40"
        >
          {O.continue}
        </button>
      )}
    </div>
  );
}

function Q({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl leading-tight">{title}</h1>
      {hint && <p className="text-ink-soft">{hint}</p>}
      {children}
    </div>
  );
}

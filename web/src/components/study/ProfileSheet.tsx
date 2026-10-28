"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lang } from "@/engine";
import { loadInvoices, saveLearner, type Course, type Learner } from "@/lib/data";
import { rupees, t } from "@/lib/i18n";
import { sb } from "@/lib/supabase";
import { INDIAN_STATES } from "@/lib/states";
import { AlertsBanner } from "./AlertsBanner";

/** Profile: the only other place in the app. Settings, legal links, invoices, delete account. */
export function ProfileSheet({
  userId,
  learner,
  course,
  onClose,
  onSaved,
}: {
  userId: string;
  learner: Learner;
  course: Course;
  onClose: () => void;
  onSaved: (l: Learner) => void;
}) {
  const [f, setF] = useState<Learner>(learner);
  const [busy, setBusy] = useState(false);
  const [invoices, setInvoices] = useState<{ id: string; invoice_no: string; total_minor: number; issued_at: string }[]>([]);
  const L = t(f.lang);
  useEffect(() => {
    loadInvoices().then(setInvoices).catch(() => {});
  }, []);

  const set = <K extends keyof Learner>(k: K, v: Learner[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    try {
      const saved = await saveLearner(userId, {
        lang: f.lang,
        exam_date: f.exam_date,
        study_times: [...new Set(f.study_times.filter(Boolean))].sort(),
        minutes_per_day: f.minutes_per_day,
        quiet_start: f.quiet_start,
        quiet_end: f.quiet_end,
        report_opt_in: f.report_opt_in,
        report_email: f.report_email,
        billing_name: f.billing_name,
        billing_state: f.billing_state,
        billing_gstin: f.billing_gstin,
      });
      onSaved(saved);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const row = "flex flex-col gap-1";
  const input = "rounded-xl border border-line bg-paper px-3 py-2";
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div
        className={`max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl ${f.lang === "hi" ? "lang-hi" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl">{L.profile}</h2>
          <button onClick={onClose} className="rounded-full border border-line px-3 py-1 text-sm">
            {L.close}
          </button>
        </div>

        <div className="space-y-4">
          <label className={row}>
            <span className="text-sm font-semibold">{L.language}</span>
            <div className="flex gap-2">
              {(["en", "hi"] as Lang[]).map((l) => (
                <button key={l} onClick={() => set("lang", l)} className={`flex-1 rounded-xl border px-3 py-2 ${f.lang === l ? "border-ink bg-ink text-paper" : "border-line"}`}>
                  {l === "en" ? "English" : "हिन्दी"}
                </button>
              ))}
            </div>
          </label>

          <label className={row}>
            <span className="text-sm font-semibold">{L.examDate}</span>
            <input type="date" value={f.exam_date} onChange={(e) => set("exam_date", e.target.value)} className={input} />
            <span className="text-xs text-muted">
              {L.examSource}: {course.exam_name}, {course.exam_date} ({course.exam_status}) — UPSC Calendar 2027
            </span>
          </label>

          <div className={row}>
            <span className="text-sm font-semibold">{L.studyTimes}</span>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  type="time"
                  value={f.study_times[i] ?? ""}
                  onChange={(e) => {
                    const times = [...f.study_times];
                    times[i] = e.target.value;
                    set("study_times", times);
                  }}
                  className={input}
                />
              ))}
            </div>
          </div>

          <label className={row}>
            <span className="text-sm font-semibold">
              {L.minutesPerDay}: {f.minutes_per_day}
            </span>
            <input type="range" min={10} max={180} step={5} value={f.minutes_per_day} onChange={(e) => set("minutes_per_day", Number(e.target.value))} />
          </label>

          <div className={row}>
            <span className="text-sm font-semibold">{L.quietHours}</span>
            <div className="flex items-center gap-2">
              <input type="time" value={f.quiet_start} onChange={(e) => set("quiet_start", e.target.value)} className={input} />
              <span>–</span>
              <input type="time" value={f.quiet_end} onChange={(e) => set("quiet_end", e.target.value)} className={input} />
            </div>
          </div>

          <div className={row}>
            <span className="text-sm font-semibold">{L.alerts}</span>
            <AlertsBanner lang={f.lang} />
          </div>

          <label className="flex items-center gap-3">
            <input type="checkbox" checked={f.report_opt_in} onChange={(e) => set("report_opt_in", e.target.checked)} className="h-5 w-5" />
            <span>{L.weeklyReport}</span>
          </label>
          {f.report_opt_in && (
            <input type="email" value={f.report_email ?? ""} onChange={(e) => set("report_email", e.target.value)} className={input} placeholder="you@example.com" />
          )}

          <details className="rounded-2xl border border-line p-3">
            <summary className="cursor-pointer text-sm font-semibold">{L.billing}</summary>
            <div className="mt-3 space-y-2">
              <input value={f.billing_name ?? ""} onChange={(e) => set("billing_name", e.target.value)} placeholder={L.billingName} className={`${input} w-full`} />
              <select value={f.billing_state ?? "Kerala"} onChange={(e) => set("billing_state", e.target.value)} className={`${input} w-full`}>
                {INDIAN_STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <input value={f.billing_gstin ?? ""} onChange={(e) => set("billing_gstin", e.target.value.toUpperCase())} placeholder={L.billingGstin} maxLength={15} className={`${input} w-full`} />
            </div>
          </details>

          {invoices.length > 0 && (
            <div className={row}>
              <span className="text-sm font-semibold">{L.invoices}</span>
              {invoices.map((iv) => (
                <Link key={iv.id} href={`/invoice/${iv.id}`} className="flex justify-between rounded-xl border border-line px-3 py-2 text-sm">
                  <span>{iv.invoice_no}</span>
                  <span>{rupees(iv.total_minor)}</span>
                </Link>
              ))}
            </div>
          )}

          <button disabled={busy} onClick={save} className="w-full rounded-2xl bg-ink px-5 py-3 font-semibold text-paper disabled:opacity-60">
            {L.save}
          </button>

          <nav className="flex flex-wrap gap-x-4 gap-y-2 pt-2 text-sm text-ink-soft">
            <Link href="/help">{L.help}</Link>
            <Link href="/privacy">{L.privacy}</Link>
            <Link href="/terms">{L.terms}</Link>
            <Link href="/delete-account">{L.deleteAccount}</Link>
            <button
              onClick={async () => {
                await sb().auth.signOut();
                location.assign(window.location.origin);
              }}
            >
              {L.signOut}
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}

/**
 * Weekly report for Algo UPSC.
 *
 * Runs on Sundays at 18:00 IST from pg_cron (supabase/setup/cron.sql). For each
 * learner who studied this week it stores the week's numbers in upsc.reports
 * (the feed shows them as a report card) and, if the learner gave a report
 * email and an email provider is set, sends a short email: days studied,
 * topics that moved from tough to easy, topics still tough (they will come
 * back), and one topic to explain to someone, because explaining is strong
 * revision. Numbers only come from upsc.weekly_report_data(); nothing is invented.
 *
 * Deploy (USS project; called by cron with the service-role key):
 *   supabase functions deploy upsc-weekly-report --no-verify-jwt
 *   optional: supabase secrets set RESEND_API_KEY=... REPORT_FROM="Algo UPSC <reports@calecutech.com>"
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SCHEMA = "upsc";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const REPORT_FROM = Deno.env.get("REPORT_FROM") ?? "Algo UPSC <reports@calecutech.com>";
const SITE = "https://upsc.calecutech.com";

type Topic = { topic: string; title: { en: string; hi: string }; cards: number };
type Report = {
  week_start: string;
  days_studied: number;
  cards_rated: number;
  new_learned: number;
  minutes: number;
  became_easy: Topic[];
  still_tough: Topic[];
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function email(r: Report, lang: "en" | "hi", name: string | null) {
  const L = lang === "hi"
    ? { hi: `नमस्ते${name ? " " + name : ""},`, days: "इस सप्ताह पढ़ाई के दिन", cards: "कार्ड", mins: "मिनट",
        easy: "कठिन से आसान बने", tough: "अभी कठिन — ये फिर आएँगे", teach: "किसी को समझाइए", open: "आज के कार्ड खोलें",
        subject: "आपका साप्ताहिक रिपोर्ट — एल्गो यूपीएससी" }
    : { hi: `Hello${name ? " " + name : ""},`, days: "Days studied this week", cards: "cards", mins: "minutes",
        easy: "Moved from tough to easy", tough: "Still tough — these will come back", teach: "Explain this to someone",
        open: "Open today's cards", subject: "Your weekly report — Algo UPSC" };
  const list = (ts: Topic[]) => ts.length
    ? `<ul>${ts.slice(0, 5).map((t) => `<li>${esc(t.title[lang] ?? t.title.en)} (${t.cards})</li>`).join("")}</ul>`
    : "<p>—</p>";
  const teach = r.became_easy[0];
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;color:#1c2140">
<p>${L.hi}</p>
<p><b>${L.days}: ${r.days_studied}/7</b> · ${r.cards_rated} ${L.cards} · ${r.minutes} ${L.mins}</p>
<h3>${L.easy}</h3>${list(r.became_easy)}
<h3>${L.tough}</h3>${list(r.still_tough)}
${teach ? `<h3>${L.teach}</h3><p>${esc(teach.title[lang] ?? teach.title.en)}</p>` : ""}
<p><a href="${SITE}/study" style="background:#1c2140;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">${L.open}</a></p>
</div>`;
  return { subject: L.subject, html };
}

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_ROLE_KEY}`) return new Response("Forbidden", { status: 403 });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { db: { schema: SCHEMA } });

  // The week that ends today (Sunday), Monday start, in IST.
  const todayIst = new Date(Date.now() + 5.5 * 3_600_000);
  const weekStart = new Date(todayIst.getTime() - ((todayIst.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);

  const { data: learners } = await admin
    .from("learners")
    .select("user_id, lang, name, report_email, report_opt_in")
    .not("onboarded_at", "is", null);

  let stored = 0, emailed = 0;
  for (const l of learners ?? []) {
    const { data, error } = await admin.rpc("weekly_report_data", { p_user_id: l.user_id, p_week_start: weekStart });
    if (error || !data) continue;
    const r = data as Report;
    if (r.cards_rated === 0) continue; // nothing to report; no nagging email either

    const { data: row } = await admin
      .from("reports")
      .upsert({ user_id: l.user_id, week_start: weekStart, data: r }, { onConflict: "user_id,week_start" })
      .select("id, sent_at")
      .single();
    stored++;

    if (!RESEND_API_KEY || !l.report_opt_in || !l.report_email || row?.sent_at) continue;
    const { subject, html } = email(r, l.lang === "hi" ? "hi" : "en", l.name);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: REPORT_FROM, to: [l.report_email], subject, html }),
    });
    if (res.ok) {
      await admin.from("reports").update({ sent_at: new Date().toISOString() }).eq("id", row!.id);
      emailed++;
    } else {
      console.error("report email failed", res.status);
    }
  }
  return new Response(JSON.stringify({ weekStart, stored, emailed }), { headers: { "Content-Type": "application/json" } });
});

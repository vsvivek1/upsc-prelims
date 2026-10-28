/**
 * Study alerts for Algo UPSC (web push).
 *
 * Runs every 10 minutes from pg_cron (see supabase/setup/cron.sql). For each
 * learner with a push subscription it sends:
 *   - a heads-up at each study time ("12 cards, about 9 minutes"), and
 *   - at most one gentle follow-up an hour later if cards are still waiting.
 * Never in quiet hours, never twice for the same slot (upsc.alert_log), and no
 * guilt messages. The card count comes from the quota snapshot the feed saves
 * on the learner row; if the snapshot is from an earlier day, the alert says
 * "your cards are ready" without a number.
 *
 * Deploy (USS project; called by cron with the service-role key, not by learners):
 *   supabase functions deploy upsc-alerts --no-verify-jwt
 *   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...
 */
import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SCHEMA = "upsc";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@calecutech.com";

const WINDOW_MIN = 15; // a slot fires once, in the first run inside this window
const FOLLOWUP_AFTER_MIN = 60;

type Learner = {
  user_id: string;
  lang: "en" | "hi";
  timezone: string;
  study_times: string[];
  quiet_start: string;
  quiet_end: string;
  quota_day: string | null;
  quota_left: number | null;
  minutes_left: number | null;
};

const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};

function localNow(tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

function inQuiet(min: number, start: string, end: string) {
  const s = toMin(start), e = toMin(end);
  return s <= e ? min >= s && min < e : min >= s || min < e;
}

function message(l: Learner, today: string, followup: boolean) {
  const fresh = l.quota_day === today && l.quota_left != null;
  const n = fresh ? l.quota_left! : null;
  const mins = fresh ? Math.max(1, l.minutes_left ?? 0) : null;
  if (l.lang === "hi") {
    return {
      title: followup ? "आपके कार्ड अभी इंतज़ार कर रहे हैं" : "पढ़ाई का समय",
      body: n != null ? `${n} कार्ड, लगभग ${mins} मिनट।` : "आज के कार्ड तैयार हैं।",
    };
  }
  return {
    title: followup ? "Your cards are still waiting" : "Time to study",
    body: n != null ? `${n} cards, about ${mins} minutes.` : "Today's cards are ready.",
  };
}

Deno.serve(async (req) => {
  // Only the cron job (service-role key) may run this.
  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_ROLE_KEY}`) return new Response("Forbidden", { status: 403 });
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return new Response("VAPID keys not set", { status: 503 });
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { db: { schema: SCHEMA } });
  const { data: subs } = await admin.from("push_subscriptions").select("endpoint, user_id, keys");
  if (!subs?.length) return new Response("no subscribers");

  const ids = [...new Set(subs.map((s) => s.user_id))];
  const { data: learners } = await admin
    .from("learners")
    .select("user_id, lang, timezone, study_times, quiet_start, quiet_end, quota_day, quota_left, minutes_left")
    .in("user_id", ids)
    .not("onboarded_at", "is", null);

  let sent = 0;
  for (const l of (learners ?? []) as Learner[]) {
    const { day, minutes } = localNow(l.timezone || "Asia/Kolkata");
    if (inQuiet(minutes, l.quiet_start, l.quiet_end)) continue;
    const doneToday = l.quota_day === day && (l.quota_left ?? 1) <= 0;
    if (doneToday) continue;

    let slot: string | null = null;
    let followup = false;
    for (const t of l.study_times ?? []) {
      const since = minutes - toMin(t);
      if (since >= 0 && since < WINDOW_MIN) slot = t;
      else if (since >= FOLLOWUP_AFTER_MIN && since < FOLLOWUP_AFTER_MIN + WINDOW_MIN) {
        slot = `followup:${t}`;
        followup = true;
      }
    }
    if (!slot) continue;

    if (followup) {
      // Follow up only on a heads-up that was actually sent.
      const { data: first } = await admin
        .from("alert_log").select("slot").eq("user_id", l.user_id).eq("day", day).eq("slot", slot.slice(9)).maybeSingle();
      if (!first) continue;
    }
    // Claim the slot first, so overlapping runs never send twice.
    const { error: claimError } = await admin.from("alert_log").insert({ user_id: l.user_id, day, slot });
    if (claimError) continue;

    // The heads-up stays on screen like an alarm; the follow-up is quieter.
    const payload = JSON.stringify({
      ...message(l, day, followup),
      url: "/study",
      tag: `study-${day}`,
      sticky: !followup,
      action: l.lang === "hi" ? "अभी शुरू करें" : "Start now",
    });
    for (const s of subs.filter((x) => x.user_id === l.user_id)) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 3600, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // 404/410: the browser dropped this subscription.
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        else console.error("push failed", code);
      }
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
});

/**
 * Algo UPSC AI help: the only place the Anthropic key is used.
 *
 * The app never sends a prompt. It sends a task name and a card id; this
 * function loads the card through the learner's own session (so row-level
 * security decides whether they may see it), builds the prompt from the card,
 * and returns short JSON. Answers are cached per card + language + pack
 * version and shared across learners. Each learner has a daily limit
 * (upsc.config.ai_daily_limit).
 *
 * Tasks: explain_again → { explain, example, check_q, check_a, key }
 *
 * Deploy (USS project):
 *   supabase functions deploy upsc-ai
 *   supabase secrets set ANTHROPIC_API_KEY=...
 */
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SCHEMA = "upsc";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Kept byte-for-byte stable so prompt caching can reuse it across learners.
const SYSTEM = `You are the Algo UPSC tutor. The learner is an adult preparing for the UPSC Civil Services Preliminary Examination in India.
Write in the language named in the task. Hindi: simple, natural Hindi in Devanagari, using the terms NCERT Hindi textbooks use. English: simple everyday words.
Use only the facts given in the SOURCE section. If they do not cover something, do not add it.
Short sentences. One idea at a time. Warm and encouraging.
Never predict marks or ranks, never compare the learner with anyone, and never mention IQ.
Return only JSON that matches the schema.`;

const EXPLAIN_SCHEMA = {
  type: "object",
  properties: {
    explain: { type: "string", description: "A fresh explanation, at most 60 words" },
    example: { type: "string", description: "One everyday Indian example, different from the card's own" },
    check_q: { type: "string", description: "One very easy check question" },
    check_a: { type: "string", description: "Its short answer" },
  },
  required: ["explain", "example", "check_q", "check_a"],
  additionalProperties: false,
};

type Text = { en?: string; hi?: string };
const pick = (t: unknown, lang: "en" | "hi") => (t && typeof t === "object" ? ((t as Text)[lang] ?? (t as Text).en ?? "") : "");

/** The card's own words, in the learner's language, as the only source the model may use. */
function sourceOf(type: string, p: Record<string, unknown>, lang: "en" | "hi") {
  const lines: string[] = [];
  const add = (label: string, v: unknown) => {
    const s = pick(v, lang);
    if (s) lines.push(`${label}: ${s}`);
  };
  if (type === "fact") {
    add("Fact", p.learn); add("Why", p.why); add("Example", p.example); add("Simple version", p.explain_simple);
  } else if (type === "steps") {
    add("Topic", p.title);
    (p.steps as { text: Text; explain?: Text }[] | undefined)?.forEach((s, i) => {
      add(`Step ${i + 1}`, s.text); add(`Step ${i + 1} reason`, s.explain);
    });
  } else if (type === "math" || type === "reasoning") {
    add("Question", p.exam_q); add("Rule", p.theory);
    (p.steps as { work: Text; why: Text }[] | undefined)?.forEach((s, i) => {
      add(`Step ${i + 1}`, s.work); add(`Step ${i + 1} reason`, s.why);
    });
    add("Answer", p.answer);
  } else if (type === "summary") {
    add("Topic", p.title);
    (p.points as Text[] | undefined)?.forEach((pt, i) => add(`Point ${i + 1}`, pt));
  }
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "AI help is not set up yet" }, 503);

  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    db: { schema: SCHEMA },
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Not signed in" }, 401);

  let task: string, cardId: string, lang: "en" | "hi";
  try {
    ({ task, cardId, lang } = await req.json());
  } catch {
    return json({ error: "Bad body" }, 400);
  }
  if (task !== "explain_again" || !cardId) return json({ error: "Unknown task" }, 400);
  lang = lang === "hi" ? "hi" : "en";

  // Through the learner's session: a locked card is simply not found.
  const { data: card } = await userClient
    .from("cards")
    .select("id, type, payload, pack_version")
    .eq("id", cardId)
    .maybeSingle();
  if (!card) return json({ error: "Card not found" }, 404);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { db: { schema: SCHEMA } });
  const key = `${task}|${card.id}|${lang}|${card.pack_version ?? ""}`;

  const { data: cached } = await admin.from("ai_cache").select("output, withdrawn").eq("key", key).maybeSingle();
  if (cached && !cached.withdrawn) return json({ ...cached.output, key });

  const { data: cfg } = await admin.from("config").select("key, value").in("key", ["ai_daily_limit", "ai_model_fast"]);
  const conf = Object.fromEntries((cfg ?? []).map((r) => [r.key, r.value]));
  const limit = Number(conf.ai_daily_limit ?? 40);
  const model = String(conf.ai_model_fast ?? "claude-haiku-5-5");

  const day = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10); // IST day
  const { data: usage } = await admin.from("ai_usage").select("calls").eq("user_id", user.id).eq("day", day).maybeSingle();
  if ((usage?.calls ?? 0) >= limit) return json({ error: "Daily AI limit reached" }, 429);
  await admin.from("ai_usage").upsert({ user_id: user.id, day, calls: (usage?.calls ?? 0) + 1 }, { onConflict: "user_id,day" });

  const source = sourceOf(card.type, card.payload ?? {}, lang);
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const started = Date.now();
  let output: Record<string, string> | null = null;
  try {
    const msg = await client.messages.create({
      model,
      max_tokens: 2000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "low", format: { type: "json_schema", schema: EXPLAIN_SCHEMA } },
      messages: [{
        role: "user",
        content: `TASK: explain_again. The learner found this card hard. Explain it again a different way.\nLANGUAGE: ${lang === "hi" ? "Hindi" : "English"}\n\nSOURCE:\n${source}`,
      }],
    });
    console.log(JSON.stringify({ task, model, ms: Date.now() - started, stop: msg.stop_reason, usage: msg.usage }));
    if (msg.stop_reason === "end_turn") {
      const text = msg.content.find((b) => b.type === "text");
      if (text && text.type === "text") output = JSON.parse(text.text);
    }
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.warn("anthropic rate limited");
    else if (e instanceof Anthropic.APIError) console.error("anthropic error", e.status, e.message);
    else console.error("ai call failed", e);
  }
  if (!output || typeof output.explain !== "string" || output.explain.split(/\s+/).length > 90) {
    return json({ error: "AI help is not available right now" }, 502);
  }

  await admin.from("ai_cache").upsert({ key, task, card_id: card.id, lang, output }, { onConflict: "key" });
  return json({ ...output, key });
});

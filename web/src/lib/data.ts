"use client";
/** Reads and writes for the study app. Everything goes through RLS with the learner's session. */
import type { CardMeta, CardState, LearnerPrefs, Rating, SittingItem, SittingKind, Mode } from "@/engine";
import type { CardRow, QuestionRow, TopicRow } from "./content";
import { sb } from "./supabase";

export interface Learner extends LearnerPrefs {
  user_id: string;
  name: string | null;
  report_email: string | null;
  report_opt_in: boolean;
  billing_name: string | null;
  billing_gstin: string | null;
  billing_state: string | null;
  onboarded_at: string | null;
  created_at: string;
}

export interface Course {
  id: string;
  title: { en: string; hi: string };
  exam_name: string;
  exam_date: string;
  exam_status: string;
  exam_source: string;
  list_price_minor: number;
  offer_price_minor: number | null;
  offer_label: string | null;
  free_card_limit: number;
}

export interface Sitting {
  id: string;
  day: string;
  kind: SittingKind;
  items: SittingItem[];
  position: number;
  seconds: Record<string, number>;
  started_at: string;
  finished_at: string | null;
}

export interface Stats {
  total_cards: number;
  free_limit: number;
  has_access: boolean;
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Reads every row of a query in pages of 1000 (the API's row limit). */
async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = check(await build(from, from + 999));
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export async function loadLearner(userId: string): Promise<Learner | null> {
  return check(await sb().from("learners").select("*").eq("user_id", userId).maybeSingle()) as Learner | null;
}

export async function saveLearner(userId: string, patch: Partial<Learner>): Promise<Learner> {
  const row = { ...patch, user_id: userId, updated_at: new Date().toISOString() };
  return check(await sb().from("learners").upsert(row).select("*").single()) as Learner;
}

/** Today's quota snapshot, so study alerts can say how many cards are waiting. */
export async function saveQuota(userId: string, q: { day: string; total: number; left: number; minutes: number }) {
  check(
    await sb()
      .from("learners")
      .update({ quota_day: q.day, quota_total: q.total, quota_left: q.left, minutes_left: q.minutes })
      .eq("user_id", userId),
  );
}

export async function loadCourse(): Promise<Course> {
  return check(await sb().from("courses").select("*").limit(1).single()) as Course;
}

export async function loadStats(): Promise<Stats> {
  return check(await sb().rpc("course_stats")) as Stats;
}

export async function loadCardMetas(): Promise<CardMeta[]> {
  return all<CardMeta>((a, b) => sb().from("cards").select("id,topic,type,seq,difficulty,freq").order("seq").range(a, b));
}

export async function loadTopics(): Promise<TopicRow[]> {
  return all<TopicRow>((a, b) => sb().from("topics").select("*").order("ord").range(a, b));
}

export async function loadStates(): Promise<CardState[]> {
  return all<CardState>((a, b) => sb().from("card_state").select("*").range(a, b));
}

export async function loadPayloads(ids: string[]): Promise<CardRow[]> {
  if (!ids.length) return [];
  return check(await sb().from("cards").select("id,topic,type,seq,difficulty,freq,payload").in("id", ids)) as CardRow[];
}

export async function loadQuestionIndex(): Promise<Pick<QuestionRow, "id" | "topic" | "covers">[]> {
  return all((a, b) => sb().from("questions").select("id,topic,covers").range(a, b));
}

export async function loadQuestions(topic: string): Promise<QuestionRow[]> {
  return check(await sb().from("questions").select("id,topic,covers,source,payload").eq("topic", topic)) as QuestionRow[];
}

export async function loadAnsweredQuestionIds(): Promise<Set<string>> {
  const rows = await all<{ question_id: string }>((a, b) => sb().from("test_answers").select("question_id").range(a, b));
  return new Set(rows.map((r) => r.question_id));
}

export async function loadOpenSitting(): Promise<Sitting | null> {
  return check(await sb().from("sittings").select("*").is("finished_at", null).maybeSingle()) as Sitting | null;
}

/** Sittings that started in the last 2 days (enough for "today" in any time zone). */
export async function loadRecentSittings(): Promise<Sitting[]> {
  const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
  return check(await sb().from("sittings").select("*").gte("started_at", since).order("started_at")) as Sitting[];
}

/** Days with at least one rating, newest first (for the streak). */
export async function loadStudyDays(): Promise<string[]> {
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString();
  const rows = await all<{ reviewed_at: string }>((a, b) =>
    sb().from("review_log").select("reviewed_at").gte("reviewed_at", since).order("reviewed_at", { ascending: false }).range(a, b),
  );
  return rows.map((r) => r.reviewed_at);
}

export async function createSitting(userId: string, day: string, kind: SittingKind, items: SittingItem[]): Promise<Sitting> {
  return check(
    await sb().from("sittings").insert({ user_id: userId, day, kind, items, position: 0, seconds: {} }).select("*").single(),
  ) as Sitting;
}

export async function updateSitting(id: string, patch: Partial<Pick<Sitting, "items" | "seconds" | "position" | "finished_at">>) {
  check(await sb().from("sittings").update(patch).eq("id", id));
}

export async function saveRating(args: {
  state: CardState;
  rating: Rating;
  mode: Mode;
  seconds: number;
  sittingId: string | null;
  position: number;
}) {
  const { state, ...rest } = args;
  check(
    await sb().rpc("save_rating", {
      p_card_id: state.card_id,
      p_state: state,
      p_rating: rest.rating,
      p_mode: rest.mode,
      p_seconds: Math.round(rest.seconds),
      p_sitting_id: rest.sittingId,
      p_position: rest.position,
    }),
  );
}

export async function saveTestAnswers(userId: string, answers: { question_id: string; chosen: number; correct: boolean }[]) {
  if (!answers.length) return;
  check(await sb().from("test_answers").insert(answers.map((a) => ({ ...a, user_id: userId }))));
}

/** Pulls cards forward (a wrong test answer makes the cards behind it due now). */
export async function makeDueNow(cardIds: string[]) {
  if (!cardIds.length) return;
  check(await sb().from("card_state").update({ due: new Date().toISOString() }).in("card_id", cardIds));
}

export async function loadLatestReport() {
  return check(await sb().from("reports").select("*").order("week_start", { ascending: false }).limit(1).maybeSingle()) as {
    id: number;
    week_start: string;
    data: Record<string, unknown>;
  } | null;
}

export async function loadInvoices() {
  return check(await sb().from("invoices").select("id,invoice_no,total_minor,issued_at").order("issued_at", { ascending: false })) as {
    id: string;
    invoice_no: string;
    total_minor: number;
    issued_at: string;
  }[];
}

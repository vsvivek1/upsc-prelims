/** Card payloads as stored in upsc.cards.payload (content schema 1.0). */
import type { Lang, T } from "@/engine";

export interface FactPayload {
  learn: T;
  why: T;
  example?: T;
  recall_q: T;
  recall_a: T;
  explain_simple: T;
  image?: string;
  min_seconds?: number;
}

export interface StepsPayload {
  title: T;
  steps: { text: T; explain?: T; min_seconds?: number }[];
  summary: T[];
  recall_q: T;
  recall_a: T;
}

export interface MathPayload {
  exam_q: T;
  exam_note?: T;
  split: { given: T; find: T; idea: T };
  theory: T;
  steps: { work: T; why: T; min_seconds?: number }[];
  answer: T;
  practice: { q: T; steps: T[]; answer: T }[];
}

export interface DiagramPayload {
  title: T;
  canvas: { w: number; h: number };
  steps: { say: T; paths?: string[]; labels?: { text: T; x: number; y: number }[]; min_seconds?: number }[];
  key_parts: T[];
  recall_prompt: T;
}

export interface SummaryPayload {
  title: T;
  points: T[];
  min_seconds?: number;
}

export type Payload = FactPayload | StepsPayload | MathPayload | DiagramPayload | SummaryPayload;

export interface CardRow {
  id: string;
  topic: string;
  type: "fact" | "steps" | "math" | "reasoning" | "diagram" | "summary";
  seq: number;
  difficulty: number;
  freq: number;
  payload: Payload;
}

export interface QuestionPayload {
  q: T;
  options: T[];
  answer: number;
  explain: T;
}

export interface QuestionRow {
  id: string;
  topic: string;
  covers: string[];
  source: string;
  payload: QuestionPayload;
}

export interface TopicRow {
  id: string;
  subject: string;
  title: T;
  ord: number;
  freq: number;
}

/** Text in the learner's language, falling back to English. */
export const tx = (t: T | undefined, lang: Lang) => (t ? t[lang] || t.en : "");

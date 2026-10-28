import type { Lang, Mode, Rating } from "@/engine";
import type { CardRow } from "@/lib/content";

export interface CardProps {
  card: CardRow;
  mode: Mode;
  lang: Lang;
  /** Seconds already seen before a reload: seeds the first screen's timer so a reload never resets it. */
  initialSeconds: number;
  progress: { pos: number; total: number };
  onToggleLang: () => void;
  onDone: (rating: Rating, honesty?: "right" | "wrong") => void;
  /** Optional AI help ("Explain it differently"); resolves to text or null when offline / unavailable. */
  askAi?: (cardId: string) => Promise<{ text: string; key: string } | null>;
  reportAi?: (key: string) => void;
}

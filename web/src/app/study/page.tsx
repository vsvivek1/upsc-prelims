import type { Metadata } from "next";
import { StudyApp } from "@/components/study/StudyApp";

export const metadata: Metadata = { title: "Daily Feed", robots: { index: false } };

export default function StudyPage() {
  return <StudyApp />;
}

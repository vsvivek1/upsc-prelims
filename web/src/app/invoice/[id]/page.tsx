import type { Metadata } from "next";
import { Suspense } from "react";
import { InvoiceView } from "@/components/InvoiceView";

export const metadata: Metadata = { title: "Tax invoice", robots: { index: false } };

export default function InvoicePage() {
  return (
    <Suspense fallback={<p className="p-6 text-muted">Loading…</p>}>
      <InvoiceView />
    </Suspense>
  );
}

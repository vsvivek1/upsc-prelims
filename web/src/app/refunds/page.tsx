import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Refunds" };

export default function Refunds() {
  return (
    <LegalPage title="Refund policy" updated="28 October 2026">
      <p>Try the first 200 cards free before you pay, so you know how Algo UPSC works.</p>
      <ul>
        <li>If you are not happy, ask for a full refund within 7 days of payment at support@calecutech.com, with your invoice number.</li>
        <li>Refunds go back to the same payment method through Razorpay, usually within 5–7 working days.</li>
        <li>A refund ends access to the paid cards; your progress on free cards stays.</li>
        <li>A credit note is issued against the GST invoice.</li>
      </ul>
    </LegalPage>
  );
}

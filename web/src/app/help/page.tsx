import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Help" };

export default function Help() {
  return (
    <LegalPage title="Help" updated="28 October 2026">
      <h2>Why can&apos;t I choose a topic?</h2>
      <p>The app decides. Choosing takes energy and makes it easy to avoid hard topics. The engine follows the syllabus, puts the most-asked topics first and brings each card back just before you would forget it.</p>
      <h2>Why are the buttons locked for a few seconds?</h2>
      <p>Understanding needs a few seconds. The timer pauses if you switch tabs.</p>
      <h2>What do the four buttons do?</h2>
      <ul>
        <li><strong>Didn&apos;t get it</strong> — explained another way, and it comes back soon.</li>
        <li><strong>Tough</strong> — a short gap before it returns.</li>
        <li><strong>Understood</strong> — a normal gap.</li>
        <li><strong>So simple</strong> — a long gap. Now and then it comes back as a quick check.</li>
      </ul>
      <h2>Alerts are not coming</h2>
      <ul>
        <li>In Profile, tap &quot;Alerts off — turn on&quot; and allow notifications.</li>
        <li>On Android Chrome: Settings → Site settings → Notifications → allow upsc.calecutech.com.</li>
        <li>Add Algo UPSC to your home screen (browser menu → Install app) so alerts arrive reliably.</li>
        <li>On Xiaomi, Vivo, Oppo or Realme phones, allow Chrome to run in the background (Battery → App battery saver → Chrome → No restrictions).</li>
      </ul>
      <h2>Payments and invoices</h2>
      <p>Pay with UPI, card or net banking through Razorpay. Your GST invoice appears in Profile → Invoices a few seconds after payment.</p>
      <h2>Contact</h2>
      <p>support@calecutech.com</p>
    </LegalPage>
  );
}

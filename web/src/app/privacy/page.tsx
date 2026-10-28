import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="28 October 2026">
      <p>
        Algo UPSC (the web app at upsc.calecutech.com and the Android app <code>com.calecutech.upsc_prelims</code>) is run by
        Calecute Technologies LLC (&quot;we&quot;). This policy explains what we collect and why. We follow India&apos;s Digital
        Personal Data Protection Act, 2023.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Account: your name and email from Google sign-in or the email link.</li>
        <li>Study settings: language, exam date, study times, minutes per day, quiet hours, report email.</li>
        <li>Learning data: which cards you saw, your ratings, time on each card, test answers and sittings.</li>
        <li>Payments: order and payment ids from Razorpay, and the billing name, state and optional GSTIN you enter for your GST invoice. We never see or store card, UPI or bank details.</li>
        <li>Alerts: if you turn on study alerts, your browser&apos;s push address (no location, no contacts).</li>
      </ul>
      <h2>Why we use it</h2>
      <ul>
        <li>To plan your study: the engine uses your ratings and timings to decide which card comes next and when.</li>
        <li>To send study alerts at your chosen times and your weekly report, if you opt in.</li>
        <li>To issue GST invoices and keep tax records the law requires.</li>
      </ul>
      <p>We use learning data only for your learning. We do not sell it, use it for advertising, or show ads. There are no ad or tracking SDKs.</p>
      <h2>AI help</h2>
      <p>
        When you ask for a different explanation, our server sends the card&apos;s text (never your name or email) to Anthropic&apos;s
        Claude API and caches the answer for other learners. You can report any AI text from the card.
      </p>
      <h2>Where it is stored</h2>
      <p>On Supabase (database and sign-in) and Vercel (web hosting). Data is encrypted in transit.</p>
      <h2>Your rights</h2>
      <ul>
        <li>See and change your settings any time in Profile.</li>
        <li>Delete your study data any time at <a href="/delete-account">Delete account</a>.</li>
        <li>Ask us anything at support@calecutech.com.</li>
      </ul>
      <h2>Retention</h2>
      <p>Study data is kept while your account is active and deleted when you delete it. Invoices and payment records are kept for eight years as Indian tax law requires.</p>
    </LegalPage>
  );
}

import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of use" };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="28 October 2026">
      <p>These terms apply to Algo UPSC, provided by Calecute Technologies LLC. By signing in you accept them.</p>
      <h2>The service</h2>
      <p>
        Algo UPSC is a study aid for the UPSC Civil Services (Preliminary) Examination. It is not affiliated with or endorsed by
        the Union Public Service Commission. Exam dates and rules come from UPSC&apos;s official notices; always check
        upsc.gov.in for the final word.
      </p>
      <h2>Free cards and the full course</h2>
      <ul>
        <li>The first 200 cards are free.</li>
        <li>The full course is a one-time payment (list price ₹10,000; introductory offer ₹3,000, including 18% GST). It gives access until the Prelims 2027 exam date and seven days after.</li>
        <li>A GST invoice is issued for every payment and is available in Profile.</li>
      </ul>
      <h2>Content</h2>
      <p>
        Cards are written from the official syllabus and NCERT textbooks and checked, but mistakes can happen. Report anything
        wrong to support@calecutech.com and we will fix it. Course content is for your personal use; do not copy or resell it.
      </p>
      <h2>Your account</h2>
      <p>Keep your sign-in to yourself. One account is for one learner.</p>
      <h2>Liability</h2>
      <p>We work hard to help you prepare, but we cannot promise any exam result. Our liability is limited to the amount you paid.</p>
      <h2>Contact</h2>
      <p>Calecute Technologies LLC · support@calecutech.com · calecutech.com</p>
    </LegalPage>
  );
}

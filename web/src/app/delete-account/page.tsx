import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { DeleteAccount } from "@/components/DeleteAccount";

export const metadata: Metadata = { title: "Delete account" };

export default function DeletePage() {
  return (
    <LegalPage title="Delete your Algo UPSC data" updated="28 October 2026">
      <p>
        This deletes your Algo UPSC study data: settings, card progress, ratings, sittings, tests, reports and alert
        subscriptions. It cannot be undone. GST invoices and payment records are kept, because Indian tax law requires it.
      </p>
      <p>
        Your sign-in is shared with other Calecute apps. To remove the sign-in itself too, email support@calecutech.com from the
        same address and we will do it within 7 days.
      </p>
      <DeleteAccount />
    </LegalPage>
  );
}

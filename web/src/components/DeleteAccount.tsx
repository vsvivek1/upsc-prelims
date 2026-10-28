"use client";
import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";

export function DeleteAccount() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  useEffect(() => {
    sb().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  if (email === undefined) return null;
  if (email === null)
    return (
      <p className="mt-6 rounded-2xl bg-saffron-soft p-4">
        <a href="/study" className="font-semibold underline">Sign in</a> first, then come back to this page.
      </p>
    );
  if (state === "done") return <p className="mt-6 rounded-2xl bg-leaf-soft p-4 text-leaf">Your Algo UPSC data has been deleted.</p>;
  return (
    <div className="mt-6 space-y-3 rounded-2xl border border-rose/40 bg-rose-soft/40 p-4">
      <p>
        Signed in as <strong>{email}</strong>. Type <strong>DELETE</strong> to confirm.
      </p>
      <input value={typed} onChange={(e) => setTyped(e.target.value)} className="w-full rounded-xl border border-line bg-paper px-3 py-2" />
      <button
        disabled={typed !== "DELETE" || state === "busy"}
        onClick={async () => {
          setState("busy");
          const { error } = await sb().rpc("delete_my_data");
          if (error) return setState("error");
          await sb().auth.signOut();
          setState("done");
        }}
        className="rounded-xl bg-rose px-4 py-2 font-semibold text-paper disabled:opacity-40"
      >
        Delete my data
      </button>
      {state === "error" && <p className="text-sm text-rose">Something went wrong. Please try again or email support@calecutech.com.</p>}
    </div>
  );
}

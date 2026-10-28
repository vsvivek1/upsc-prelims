"use client";
import { useState } from "react";
import type { Lang } from "@/engine";
import type { Course } from "@/lib/data";
import { rupees, t } from "@/lib/i18n";
import { callFunction, sb } from "@/lib/supabase";
import { INDIAN_STATES } from "@/lib/states";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: () => void) => void };
  }
}

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/** Shown in the feed when the free cards are done (never inside a sitting). Razorpay → webhook grants access. */
export function UnlockCard({ lang, course, onPaid }: { lang: Lang; course: Course; onPaid: () => void }) {
  const L = t(lang);
  const [status, setStatus] = useState<"idle" | "details" | "paying" | "waiting" | "failed">("idle");
  const [name, setName] = useState("");
  const [state, setState] = useState("Kerala");
  const [gstin, setGstin] = useState("");
  const price = course.offer_price_minor ?? course.list_price_minor;

  async function pay() {
    setStatus("paying");
    const { data } = await sb().auth.getUser();
    const uid = data.user?.id;
    if (!uid) return setStatus("failed");
    await sb()
      .from("learners")
      .update({ billing_name: name.trim() || null, billing_state: state, billing_gstin: gstin.trim().toUpperCase() || null })
      .eq("user_id", uid);
    const ok = await loadCheckout();
    if (!ok || !window.Razorpay) return setStatus("failed");
    try {
      const order = await callFunction<{ orderId: string; amount: number; currency: string; keyId: string; courseName: string }>(
        "upsc-razorpay-create-order",
        { courseId: course.id },
      );
      const rz = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "Calecute Technologies",
        description: order.courseName,
        prefill: { email: data.user?.email, name: name.trim() || undefined },
        theme: { color: "#1c2140" },
        handler: async () => {
          // The browser callback grants nothing; wait for the signed webhook.
          setStatus("waiting");
          for (let i = 0; i < 20; i++) {
            const { data: has } = await sb().rpc("has_access");
            if (has) return onPaid();
            await new Promise((r) => setTimeout(r, 2000));
          }
          onPaid();
        },
        modal: { ondismiss: () => setStatus("idle") },
      });
      rz.on("payment.failed", () => setStatus("failed"));
      rz.open();
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="rounded-3xl bg-ink p-6 text-paper">
      <p className="font-display text-2xl">{L.unlockTitle}</p>
      <p className="mt-2 text-paper/80">{L.unlockBody}</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        {course.offer_price_minor && <span className="text-xl text-paper/50 line-through">{rupees(course.list_price_minor)}</span>}
        <span className="font-display text-4xl text-saffron">{rupees(price)}</span>
        <span className="pb-1 text-xs text-paper/70">
          {course.offer_price_minor ? `${L.offer} · ` : ""}
          {L.inclGst}
        </span>
      </div>

      {status === "details" ? (
        <div className="mt-5 space-y-3 rounded-2xl bg-paper p-4 text-ink">
          <p className="text-sm font-semibold">{L.billing}</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={L.billingName} className="w-full rounded-xl border border-line px-3 py-2" />
          <select value={state} onChange={(e) => setState(e.target.value)} className="w-full rounded-xl border border-line px-3 py-2" aria-label={L.billingState}>
            {INDIAN_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder={L.billingGstin} className="w-full rounded-xl border border-line px-3 py-2 uppercase" maxLength={15} />
          <button onClick={pay} className="w-full rounded-2xl bg-saffron px-5 py-3 font-semibold text-ink">
            {L.pay} — {rupees(price)}
          </button>
        </div>
      ) : (
        <button
          disabled={status === "paying" || status === "waiting"}
          onClick={() => setStatus("details")}
          className="mt-5 w-full rounded-2xl bg-saffron px-5 py-3 text-lg font-semibold text-ink disabled:opacity-60"
        >
          {status === "paying" ? L.paying : status === "waiting" ? L.paid : L.pay}
        </button>
      )}
      {status === "failed" && <p className="mt-3 text-sm text-rose-soft">{L.payFailed}</p>}
    </div>
  );
}

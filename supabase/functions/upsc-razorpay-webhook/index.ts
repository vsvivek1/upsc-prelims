/**
 * Razorpay webhook for Algo UPSC: the only thing that grants paid access, and
 * the place the GST invoice is issued.
 *
 * Mirrors ga-razorpay-webhook on the same Razorpay account. Razorpay sends every
 * account event to every webhook, so payments for other apps arrive here too:
 * those are acknowledged (200) and ignored (notes.app must be "upsc").
 *
 * Access lasts until courses.access_until, or 7 days after the exam date.
 * The invoice is issued by upsc.issue_invoice(), which numbers it per
 * financial year and splits CGST + SGST or IGST. If it fails (for example the
 * seller GSTIN is not set yet), access is still granted and the error logged;
 * calling the webhook again for the same payment issues it later.
 *
 * Deploy (USS project; the signature is the auth, not a Supabase JWT):
 *   supabase functions deploy upsc-razorpay-webhook --no-verify-jwt
 * Razorpay dashboard > Webhooks: URL .../functions/v1/upsc-razorpay-webhook,
 * events payment.captured and refund.processed, same secret as RAZORPAY_WEBHOOK_SECRET.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SCHEMA = "upsc";
const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** HMAC-SHA256 of the raw body, compared in constant time. */
async function isSignatureValid(secret: string, raw: string, signature: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (!WEBHOOK_SECRET) return new Response("Not configured", { status: 503 });

  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) return new Response("Unsigned", { status: 401 });

  // Byte-for-byte body; re-serialised JSON would not match the signature.
  const raw = await req.text();
  if (!(await isSignatureValid(WEBHOOK_SECRET, raw, signature))) {
    console.warn("rejected a webhook with a bad signature");
    return new Response("Bad signature", { status: 401 });
  }

  const event = JSON.parse(raw);
  const status = event.event === "payment.captured" ? "active" : event.event === "refund.processed" ? "refunded" : null;
  if (!status) return new Response("ignored", { status: 200 });

  // Refund events carry the original payment entity too, with its notes.
  const payment = event.payload?.payment?.entity;
  const notes = payment?.notes ?? {};
  if (!payment?.id || notes.app !== SCHEMA || !notes.user_id || !notes.course_id) {
    return new Response("ignored", { status: 200 });
  }
  const userId: string = notes.user_id;
  const courseId: string = notes.course_id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { db: { schema: SCHEMA } });

  const { data: course } = await admin
    .from("courses")
    .select("id, exam_date, access_until")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return new Response("ignored", { status: 200 });

  const end = course.access_until
    ? new Date(`${course.access_until}T23:59:59+05:30`)
    : new Date(new Date(`${course.exam_date}T23:59:59+05:30`).getTime() + 7 * 86_400_000);

  // Upsert on provider_ref: webhooks arrive more than once, and a refund must
  // update the same row the capture created.
  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      course_id: courseId,
      provider: "razorpay",
      provider_ref: payment.id,
      amount_minor: payment.amount ?? null,
      status,
      current_period_end: end.toISOString(),
    },
    { onConflict: "provider_ref" },
  );
  if (error) {
    console.error("could not record the subscription", error);
    // 500 makes Razorpay retry: the payment happened and the learner is waiting.
    return new Response("retry", { status: 500 });
  }

  if (payment.order_id) {
    await admin
      .from("payment_orders")
      .update({ status: status === "active" ? "paid" : "refunded" })
      .eq("provider_ref", payment.order_id);
  }

  if (status === "active") {
    const { error: invoiceError } = await admin.rpc("issue_invoice", {
      p_payment_ref: payment.id,
      p_user_id: userId,
      p_course_id: courseId,
      p_total_minor: payment.amount,
    });
    if (invoiceError) console.error("invoice not issued yet", payment.id, invoiceError.message);
  }

  return new Response("ok", { status: 200 });
});

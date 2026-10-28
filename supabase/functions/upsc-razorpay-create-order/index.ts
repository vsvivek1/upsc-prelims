/**
 * Creates a Razorpay order for Algo UPSC.
 *
 * Same contract as ga-razorpay-create-order (Geological Assistant), on the same
 * Razorpay account, but reads and writes the `upsc` schema. The client names a
 * course; the price comes from upsc.courses: the introductory offer when one
 * is set, otherwise the list price. Prices include GST.
 *
 * Deploy (USS project):
 *   supabase functions deploy upsc-razorpay-create-order
 *   (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are already set for Geological Assistant)
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SCHEMA = "upsc";
const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return json({ error: "Payments are not set up yet" }, 503);

  // The caller is whoever the JWT says, never a user id in the body.
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Not signed in" }, 401);

  let courseId: string;
  try {
    ({ courseId } = await req.json());
  } catch {
    return json({ error: "Bad body" }, 400);
  }
  if (!courseId) return json({ error: "courseId is required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { db: { schema: SCHEMA } });

  const { data: course } = await admin
    .from("courses")
    .select("id, title, list_price_minor, offer_price_minor, price_currency")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return json({ error: "Unknown course" }, 404);
  const amount = course.offer_price_minor ?? course.list_price_minor;
  if (!amount || amount <= 0) return json({ error: "This course has no price set" }, 409);

  // Already paid: do not take the money twice.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .eq("status", "active")
    .limit(1);
  if (existing && existing.length > 0) return json({ error: "Already subscribed" }, 409);

  const currency = course.price_currency ?? "INR";
  const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,
      receipt: `upsc_${user.id.slice(0, 8)}_${Date.now()}`,
      // Echoed back on the webhook; `app` lets each webhook skip payments that
      // belong to other courses on the same Razorpay account.
      notes: { user_id: user.id, course_id: courseId, app: SCHEMA },
    }),
  });
  if (!orderResponse.ok) {
    console.error("razorpay order failed", orderResponse.status, await orderResponse.text());
    return json({ error: "Could not start the payment" }, 502);
  }
  const order = await orderResponse.json();

  const { error: insertError } = await admin.from("payment_orders").insert({
    user_id: user.id,
    course_id: courseId,
    provider: "razorpay",
    provider_ref: order.id,
    amount_minor: amount,
    currency,
    status: order.status ?? "created",
  });
  if (insertError) console.error("could not record the order", insertError);

  // The key id is public; the secret never leaves this function.
  return json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: RAZORPAY_KEY_ID,
    courseName: course.title?.en ?? "Algo UPSC",
  });
});

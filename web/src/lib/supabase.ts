"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public values: the publishable key only allows what RLS allows.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://vspbbwpehvenmxddgbhm.supabase.co";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_8yQLCPZV55NwBKI5ybeRAg__UggFFK_";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- no generated DB types yet
type Db = any;
let client: SupabaseClient<Db, "upsc"> | null = null;

/** One browser client, pointed at the `upsc` schema. Session kept in localStorage (PKCE flow). */
export function sb(): SupabaseClient<Db, "upsc"> {
  if (!client) {
    client = createClient<Db, "upsc">(SUPABASE_URL, SUPABASE_KEY, {
      db: { schema: "upsc" },
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export const functionsUrl = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`;

/** Calls an Edge Function with the learner's session. */
export async function callFunction<R>(name: string, body: unknown): Promise<R> {
  const { data } = await sb().auth.getSession();
  const res = await fetch(functionsUrl(name), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${data.session?.access_token ?? SUPABASE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`);
  return json as R;
}

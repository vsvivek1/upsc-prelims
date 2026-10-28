"use client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { loadCourse, loadLearner, type Course, type Learner } from "@/lib/data";
import { sb } from "@/lib/supabase";
import { t } from "@/lib/i18n";
import { Logo } from "../Logo";
import { Feed } from "./Feed";
import { Onboarding } from "./Onboarding";

/** /study: sign in → onboarding (once) → the Daily Feed. */
export function StudyApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [learner, setLearner] = useState<Learner | null | undefined>(undefined);
  const [course, setCourse] = useState<Course | null>(null);

  useEffect(() => {
    sb()
      .auth.getSession()
      .then(({ data }) => setSession(data.session));
    const { data } = sb().auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    loadLearner(uid)
      .then(setLearner)
      .catch(() => setLearner(null));
    loadCourse()
      .then(setCourse)
      .catch(() => {});
  }, [uid]);

  if (session === undefined || (session && learner === undefined))
    return <div className="flex flex-1 items-center justify-center text-muted">Loading…</div>;
  if (!session) return <SignIn />;
  if (!learner || !learner.onboarded_at)
    return (
      <Onboarding
        userId={session.user.id}
        email={session.user.email ?? null}
        name={(session.user.user_metadata?.full_name as string) ?? null}
        course={course}
        onDone={setLearner}
      />
    );
  return <Feed userId={session.user.id} learner={learner} onLearner={setLearner} />;
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/study` : undefined;
  const en = t("en");
  const hi = t("hi");
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <Logo />
      <div>
        <h1 className="font-display text-3xl">{en.signIn}</h1>
        <p className="lang-hi text-ink-soft">{hi.signIn}</p>
      </div>
      <button
        onClick={async () => {
          const { error } = await sb().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
          if (error) setErr(error.message);
        }}
        className="flex items-center justify-center gap-3 rounded-2xl border border-line bg-card px-5 py-3 text-lg font-semibold shadow-sm"
      >
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {en.signInGoogle}
      </button>
      <div className="space-y-2">
        <p className="text-sm text-muted">
          {en.emailCode} · <span className="lang-hi">{hi.emailCode}</span>
        </p>
        {sent ? (
          <p className="rounded-xl bg-leaf-soft p-3 text-leaf">{en.linkSent}</p>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const { error } = await sb().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
              if (error) setErr(error.message);
              else setSent(true);
            }}
          >
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2" />
            <button className="rounded-xl bg-ink px-4 py-2 font-semibold text-paper">{en.sendLink}</button>
          </form>
        )}
        {err && <p className="text-sm text-rose">{err}</p>}
      </div>
      <p className="text-xs text-muted">
        By continuing you agree to the <a href="/terms" className="underline">Terms</a> and <a href="/privacy" className="underline">Privacy policy</a> of Calecute Technologies LLC.
      </p>
    </div>
  );
}

# Tech stack

Versions checked on 28 October 2026.

| Need | Choice | Why |
|---|---|---|
| Web framework | Next.js 16.4.3 (App Router), React 19.3 | Same stack as QuizKerala on calecutech.com; static shells plus route handlers |
| Styling | Tailwind CSS 4.3 | Fast, no extra CSS files; its own look, distinct from other Recallio apps |
| Backend, auth | Supabase (USS project), `@supabase/supabase-js` 2.118 | Rule: one Supabase project for the Recallio family, one schema per course |
| Spaced repetition | `ts-fsrs` 5.4.2 (FSRS-6) behind `engine/scheduler.ts` | Open-spaced-repetition reference port; wrapped so it can be tuned or swapped |
| Tests | Vitest | Engine unit tests (intervals, exam cap, planner, sitting builder) |
| Payments | Razorpay Checkout + Supabase Edge Functions | Reuses the Geological Assistant flow and Razorpay account |
| Study alerts | Web Push (service worker, VAPID) sent by `upsc-alerts` with `web-push` 3.6.7, every 10 min on pg_cron + pg_net | Browser equivalent of the alarm-style alert |
| AI | Anthropic TypeScript SDK in the `upsc-ai` Edge Function, JSON-schema output, model from `upsc.config` (`claude-haiku-5-5`) | The key never reaches the browser; answers cached and shared |
| Weekly report | SQL `upsc.weekly_report_data()` + `upsc-weekly-report` Edge Function (Sunday 18:00 IST); optional email through Resend | Numbers come from SQL only; email is skipped until a `RESEND_API_KEY` is set |
| Content | Python authoring helpers → JSON pack → `validate_pack.py` → SQL seed | Reviewable text in git; one repeatable upload |
| Hosting | Vercel, domain upsc.calecutech.com | calecutech.com is already on the Vercel team |
| Android (phase two) | Flutter + Riverpod + drift + supabase_flutter | Recallio standard |

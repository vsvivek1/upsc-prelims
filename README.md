# Algo UPSC — algorithmic learning for UPSC Prelims

Algo UPSC is a Recallio (Spaced Loop) course for the UPSC Civil Services
Preliminary Examination. The app decides what the learner studies: one small
card at a time, at set study times, and the learner's own rating decides when
each card comes back. The plan works backwards from the exam date
(Prelims 2027: **23 May 2027**) and switches to cram mode in the last two days.

- Web app: https://upsc.calecutech.com (Next.js on Vercel)
- Android app: `com.calecutech.upsc_prelims` (Flutter, `app/`, second phase)
- Backend: the shared Recallio Supabase project (USS), schema `upsc`
- Languages: English and Hindi
- Price: first 200 cards free; full course ₹10,000, introductory offer ₹3,000 (Razorpay, GST invoice)

## What is in this repo

| Path | |
|---|---|
| `web/` | The Next.js web app: landing page, sign-in, onboarding, Daily Feed, payments, invoices |
| `web/src/engine/` | The learning engine: FSRS scheduler, daily planner, sitting builder, minimum-time rules |
| `content/` | Course content packs (JSON, schema 1.0) and the upload script output |
| `supabase/migrations/` | The `upsc` schema: content, learner tables, payments, invoices, RLS |
| `supabase/functions/` | Edge Functions: Razorpay order and webhook, AI tutor, study alerts, weekly report |
| `scripts/validate_pack.py` | Checks a content pack before upload |
| `app/` | Flutter Android app (phase two) |
| `docs/` | Architecture, tech stack and learning engine notes |

## Run the web app

```bash
cd web
cp .env.example .env.local   # fill in the Supabase URL and publishable key
pnpm install
pnpm dev
pnpm test                    # engine unit tests
```

## Content

```bash
python3 scripts/validate_pack.py content/upsc_prelims.json
node scripts/pack-to-sql.mjs content/upsc_prelims.json > /tmp/pack.sql   # upsert into Supabase
```

Cards teach facts from the official UPSC syllabus and the NCERT books it rests
on. Past papers only rank topics and supply test questions; they never appear
as lesson cards.

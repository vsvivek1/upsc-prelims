# Architecture

Algo UPSC is one Recallio course. The web app ships first; the Flutter
Android app follows and talks to the same Supabase schema, so a learner's
progress moves between web and phone.

```
browser (upsc.calecutech.com)            Supabase (USS project)
  Next.js 16, client-side study app  ──►   schema upsc: content, learner state, payments
  engine/ (FSRS, planner, sittings)        auth: Google + email code
  service worker (web push alerts)   ◄──   edge functions: upsc-alerts (pg_cron, every 10 min)
                                            upsc-ai (Anthropic proxy)
                                            upsc-weekly-report (pg_cron, Sunday 18:00 IST)
  Razorpay Checkout                  ──►   upsc-razorpay-create-order
  Razorpay webhook                   ──►   upsc-razorpay-webhook → subscription + GST invoice
```

## Why the study app runs in the browser

The Daily Feed is a single highly interactive screen: timers that pause when
the tab is hidden, a card that never moves without a rating, resume after a
reload. The engine runs client-side and writes straight to Supabase through
row-level security, so the page needs no server round trip per card and the
same engine logic can be ported to Dart for the Flutter app. Next.js renders
the static shells (landing, legal pages) and hosts route handlers only where a
server is needed (the invoice page).

## Data flow for one card

1. On open, the feed loads the learner row, every unlocked card's metadata,
   the learner's `card_state` rows and the open sitting (if any).
2. If no sitting is open and one is due, the sitting builder picks up to 10
   cards and saves the sitting (card ids, position, seconds seen per card).
3. The card's minimum time counts only while the tab is visible; seconds are
   saved to the sitting row and localStorage every few seconds.
4. A rating runs the FSRS update (with the exam-date cap), writes
   `card_state`, appends `review_log` and advances the sitting position in one
   RPC (`upsc.save_rating`), then the next card shows.

## Schema `upsc`

| Table | |
|---|---|
| `courses` | One row: titles, exam, prices, free card limit, access end |
| `exam_info` | Official exam dates with source and last-checked date |
| `topics`, `cards`, `questions` | Content pack (payload jsonb), `seq` = teaching order |
| `learners` | Exam date, language, study times, minutes per day, quiet hours, report opt-in |
| `card_state` | FSRS fields plus `last_rating`, `ever_tough`, `tough_streak`, `honesty_misses`, `recent` |
| `review_log` | Append-only rating log |
| `sittings` | Each sitting: card ids, position, seconds per card, kind (normal, bonus, cram) |
| `reports` | Weekly report numbers (JSON) |
| `push_subscriptions` | Web push endpoints per learner |
| `ai_cache`, `ai_flags` | Cached AI explanations and learner reports of bad AI text |
| `payment_orders`, `subscriptions`, `invoices` | Razorpay orders, access grants and GST invoices |
| `config` | Tunable engine numbers and AI model ids |

Access rule: any signed-in learner reads cards with `seq <= free_card_limit`;
the rest need an active subscription (`upsc.has_access()`).

## Content pipeline

```
content/src/<subject>.py ──► content/build.py ──► content/upsc_prelims.json
                                                     │  scripts/validate_pack.py (must PASS)
                                                     ▼
                              scripts/pack_to_sql.py ──► supabase/seed/content.sql ──► upsc.topics/cards/questions
```

- Each subject file lists its topics (syllabus order, how often asked) and
  cards; `build.py` interleaves subjects topic by topic and numbers the cards
  (`seq`). The first 200 by `seq` are the free tier.
- The seed upserts by id and deletes cards no longer in the pack, so it can be
  re-run after every content change. Card ids never change once published,
  because learner progress is keyed on them.
- Every card starts as `needs_review`; practice questions say "Practice — exam
  pattern (not from a past paper)" until real past-paper citations are added.
- Tested against a local Postgres 16 with stub `auth` roles: migration, seed,
  RLS free limit (200 of 239 visible), `save_rating` and `delete_my_data`.

## Payments

Same contract as Geological Assistant: the client asks
`upsc-razorpay-create-order` for an order (price from `upsc.courses`, never
from the client), Razorpay Checkout takes the money, and only the signed
webhook grants access and issues the GST invoice. The Razorpay account is
shared; the webhook ignores payments whose notes name another app.

- Price: `offer_price_minor` (₹3,000 introductory offer) when set, otherwise
  `list_price_minor` (₹10,000). Prices include 18% GST.
- Access runs to `courses.access_until`, or 7 days after the exam date.
- `upsc.issue_invoice()` (service role only) numbers invoices per financial
  year (`AU/2026-27/0001`) under an advisory lock, works out the taxable value
  from the GST-inclusive price, and charges CGST + SGST when the buyer's state
  matches the seller's, IGST otherwise. It copies the seller details from
  `upsc.config.seller` into the invoice so later changes don't rewrite old
  invoices. It refuses to issue while the seller GSTIN is empty; the webhook
  still grants access and logs the error, and a re-delivered webhook issues it.
- Example on ₹3,000: taxable ₹2,542.37, tax ₹457.63 (Kerala buyer: CGST
  ₹228.81 + SGST ₹228.82; other states: IGST ₹457.63).

## Alerts, AI and the weekly report

- **Alerts.** The feed saves today's quota on the learner row
  (`quota_day`, `quota_left`, `minutes_left`). `upsc-alerts` runs every 10
  minutes, sends one alarm-style push per study time and at most one follow-up
  an hour later, skips quiet hours and finished quotas, and claims each slot in
  `alert_log` before sending so a slot never fires twice.
- **AI.** `upsc-ai` takes a task name and a card id only. It reads the card with
  the learner's own session (RLS hides locked cards), builds the prompt from the
  card's text, returns schema-checked JSON, and caches it per card + language +
  pack version. Every AI answer in the app has a Report button (`ai_flags`).
- **Weekly report.** `upsc.weekly_report_data()` computes days studied, cards,
  minutes, topics that went from tough to easy, and topics still tough.
  `upsc-weekly-report` stores it in `upsc.reports` on Sunday evening and emails
  it when the learner gave an address. The feed shows it once, after the day's
  quota, with a "Review this week" button that brings five of the week's cards
  back as due.
- Cron jobs: `supabase/setup/cron.sql` (run once, needs the service-role key in Vault).

## Hosting

- Vercel project `algo-upsc` (team "vivek's projects"), root directory `web`,
  deploys on every push to the production branch.
- Domain `upsc.calecutech.com` is attached. calecutech.com's DNS is at
  Squarespace, so the record is added there: CNAME `upsc` →
  `005891e463024931.vercel-dns-017.com`.
- Supabase Auth needs `https://upsc.calecutech.com/**` in its redirect URLs, and
  the `upsc` schema must be listed under Data API → Exposed schemas.

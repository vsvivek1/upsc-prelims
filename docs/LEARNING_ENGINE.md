# Learning engine (Algo UPSC)

The Recallio Spaced Loop rules, as built in `web/src/engine/`. Numbers marked
*config* live in `upsc.config` so they can be tuned without a release.

## Fixed rules

1. The app decides. No topic list, browser, search or "study this" button.
2. One menu: the Daily Feed. The header holds only the profile button and the gift icon.
3. No scrolling or skipping. Reload, back button or closing the tab brings the same card back. Only a rating moves on.
4. Four ratings: Didn't get it · Tough · Understood · So simple (Hindi: समझ नहीं आया · कठिन · समझ गया · बहुत आसान) → FSRS Again · Hard · Good · Easy.
5. Rating buttons unlock after the card's minimum time; the timer pauses while the tab is hidden.
6. At most 10 cards per sitting (math and reasoning count as 2 slots).
7. Sittings at set study times (web push alerts); quota always visible; bonus sittings only after a 90-minute gap.
8. The exam date drives the plan: Prelims 2027 is 23 May 2027 (official, UPSC calendar 2027). Cram mode the last two days.
9. Content from the official syllabus; past papers rank topics and supply test questions only.
10. AI only through the `upsc-ai` Edge Function.
11. Weekly report to the learner (adult course).

## FSRS

- `ts-fsrs` with desired retention 0.90 (*config* `retention`), fuzz on.
- **Exam cap:** no review is scheduled after exam date − 3 days. A later FSRS due date is pulled back to the cap.
- "Still tough" cards (Tough or Didn't get it in 2 of the last 3 ratings) treat Hard as Again for scheduling once.
- Stored per learner and card: FSRS fields + `last_rating`, `ever_tough`, `tough_streak`, `honesty_misses`, `recent` (last three ratings), `honesty_due`.

## Minimum time

`words` = words on the screen in the shown language. Adult course, so no child factor. Hindi × 1.15 (Devanagari reads a little slower than English for most learners).

| Screen | Seconds |
|---|---|
| fact learn | clamp(words/2 + 2, 5, 25) |
| fact recall | 4 s before "Show answer", then clamp(words/2.5, 3, 15) |
| step | clamp(words/2 + 3, 6, 30) |
| math / reasoning step | clamp(words/2 + 6, 8, 40) |
| summary | clamp(words/2, 8, 30) |

## Daily plan

```
days_left       = exam_date − today
revision_window = min(14, round(days_left × 0.15))
learn_days      = max(1, days_left − revision_window − 2)
new_per_day     = ceil(new_cards_left / learn_days), at least 5 (*config* min_new_per_day)
reviews_today   = due reviews, capped at 2 × new_per_day + 20
daily_quota     = new_per_day + reviews_today
```

New cards follow `seq` (syllabus order with prerequisites, higher exam
frequency first within open topics). Free learners stop at card 200 and see
the unlock card.

## Sitting builder

Slots = min(10, focus_size, quota left). Fill: today's "Didn't get it" (≤ 2)
→ due reviews, lowest predicted recall first (≤ 60 %) → new cards → honesty
checks. Arrange: easiest first and last, no two from one topic back to back,
no two long cards back to back.

## Bonus sittings

After the quota: "Next set opens at …" ≥ 90 minutes after the last sitting,
at most 2 a day, never in quiet hours (21:30–06:30, *config*). Holds reviews
due in the next 2 days plus up to 5 of tomorrow's new cards.

## Cram mode

From exam date − 2 days: summary cards per topic, all still-tough cards, top
frequency first; 10-card sittings with 5-minute breaks. Exam morning: easy-win
cards and the checklist (admit card, photo ID, black ball pen, reach early).

## UPSC specifics

- GS Paper I: 100 questions, 200 marks, one third negative marking. Test cards show that rule.
- CSAT Paper II: qualifying at 33 %; reasoning and numeracy use reasoning and math cards.
- Current affairs cards carry a `valid_until` date in `review_note`; the content team refreshes them monthly.

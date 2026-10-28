-- Algo UPSC (Recallio course for UPSC Prelims) — schema `upsc` in the USS project.
-- Shared tables in `public` are not touched.

create schema if not exists upsc;
grant usage on schema upsc to anon, authenticated, service_role;

-- ---------------------------------------------------------------- content

create table upsc.courses (
  id                 text primary key,
  title              jsonb not null,
  exam_name          text not null,
  exam_date          date not null,
  exam_status        text not null check (exam_status in ('official', 'estimated')),
  exam_source        text not null,
  exam_checked_at    date not null,
  list_price_minor   integer not null,          -- ₹10,000 = 1000000 paise
  offer_price_minor  integer,                   -- ₹3,000 introductory offer
  offer_label        text,
  price_currency     text not null default 'INR',
  gst_rate           numeric not null default 0.18,
  price_includes_gst boolean not null default true,
  sac_code           text not null default '999293',
  free_card_limit    integer not null default 200,
  access_until       date,                      -- null = until the exam date + 7 days
  pack_version       text,
  created_at         timestamptz not null default now()
);

create table upsc.topics (
  id       text primary key,
  subject  text not null,
  title    jsonb not null,
  ord      integer not null,
  freq     real not null default 0.5 check (freq between 0 and 1),
  prereq   text[] not null default '{}'
);

create table upsc.cards (
  id          text primary key,
  topic       text not null references upsc.topics(id) on update cascade,
  type        text not null check (type in ('fact','steps','math','reasoning','diagram','summary')),
  seq         integer not null,                 -- teaching order; free tier = seq <= free_card_limit
  difficulty  smallint not null default 2 check (difficulty between 1 and 5),
  freq        real not null default 0.5,
  status      text not null default 'needs_review' check (status in ('draft','needs_review','reviewed')),
  payload     jsonb not null,
  pack_version text,
  updated_at  timestamptz not null default now()
);
create unique index cards_seq_idx on upsc.cards(seq);
create index cards_topic_idx on upsc.cards(topic);

create table upsc.questions (
  id       text primary key,
  topic    text not null references upsc.topics(id) on update cascade,
  seq      integer not null,                    -- highest seq among the cards it covers
  covers   text[] not null,
  source   text not null,
  year     integer,
  payload  jsonb not null
);
create index questions_covers_idx on upsc.questions using gin(covers);

create table upsc.config (
  key   text primary key,
  value jsonb not null
);

-- ---------------------------------------------------------------- learners

create table upsc.learners (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  name             text,
  lang             text not null default 'en' check (lang in ('en','hi')),
  exam_date        date not null default '2027-05-23',
  study_times      text[] not null default '{07:00,13:30,19:00}',  -- local HH:MM
  minutes_per_day  integer not null default 30 check (minutes_per_day between 5 and 300),
  quiet_start      text not null default '21:30',
  quiet_end        text not null default '06:30',
  timezone         text not null default 'Asia/Kolkata',
  focus_size       smallint not null default 10 check (focus_size between 5 and 10),
  report_email     text,
  report_opt_in    boolean not null default true,
  billing_name     text,
  billing_gstin    text,
  billing_state    text,
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table upsc.card_state (
  user_id         uuid not null references auth.users(id) on delete cascade,
  card_id         text not null references upsc.cards(id) on delete cascade on update cascade,
  due             timestamptz not null,
  stability       double precision not null default 0,
  difficulty      double precision not null default 0,
  scheduled_days  integer not null default 0,
  learning_steps  integer not null default 0,
  reps            integer not null default 0,
  lapses          integer not null default 0,
  state           smallint not null default 0,  -- 0 new, 1 learning, 2 review, 3 relearning
  last_review     timestamptz,
  last_rating     smallint,
  recent          smallint[] not null default '{}',  -- last three ratings, newest last
  ever_tough      boolean not null default false,
  tough_streak    smallint not null default 0,
  honesty_misses  smallint not null default 0,
  honesty_due     timestamptz,
  first_seen      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (user_id, card_id)
);
create index card_state_due_idx on upsc.card_state(user_id, due);

create table upsc.review_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  card_id     text not null,
  rating      smallint not null check (rating between 1 and 4),
  mode        text not null check (mode in ('learn','recall','check','test','cram','honesty')),
  seconds     integer not null default 0,
  sitting_id  uuid,
  reviewed_at timestamptz not null default now()
);
create index review_log_user_idx on upsc.review_log(user_id, reviewed_at);

create table upsc.sittings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  day          date not null,
  kind         text not null default 'normal' check (kind in ('normal','bonus','cram','welcome')),
  items        jsonb not null,          -- [{card_id, mode}]
  position     integer not null default 0,
  seconds      jsonb not null default '{}'::jsonb,  -- {card_id: seconds seen}
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index sittings_user_idx on upsc.sittings(user_id, started_at desc);
-- one open sitting per learner
create unique index sittings_one_open on upsc.sittings(user_id) where finished_at is null;

create table upsc.test_answers (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  question_id  text not null,
  chosen       smallint not null,
  correct      boolean not null,
  answered_at  timestamptz not null default now()
);

create table upsc.reports (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  week_start  date not null,
  data        jsonb not null,
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, week_start)
);

create table upsc.push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  keys        jsonb not null,
  created_at  timestamptz not null default now()
);

create table upsc.alert_log (
  user_id   uuid not null references auth.users(id) on delete cascade,
  day       date not null,
  slot      text not null,            -- study time 'HH:MM', 'followup:HH:MM' or 'quota'
  sent_at   timestamptz not null default now(),
  primary key (user_id, day, slot)
);

create table upsc.ai_cache (
  key         text primary key,       -- task|card|level|lang|pack_version
  task        text not null,
  card_id     text,
  lang        text not null,
  output      jsonb not null,
  withdrawn   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table upsc.ai_usage (
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null,
  calls    integer not null default 0,
  primary key (user_id, day)
);

create table upsc.ai_flags (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  cache_key  text not null,
  reason     text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- payments

create table upsc.payment_orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  course_id     text not null references upsc.courses(id),
  provider      text not null default 'razorpay',
  provider_ref  text not null unique,
  amount_minor  integer not null,
  currency      text not null default 'INR',
  status        text not null default 'created',
  created_at    timestamptz not null default now()
);

create table upsc.subscriptions (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  course_id          text not null references upsc.courses(id),
  provider           text not null default 'razorpay',
  provider_ref       text unique,
  amount_minor       integer,
  status             text not null default 'active',
  current_period_end timestamptz,
  created_at         timestamptz not null default now()
);

create table upsc.invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_no      text not null unique,          -- AU/2026-27/0001
  fy              text not null,
  fy_seq          integer not null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  course_id       text not null references upsc.courses(id),
  payment_ref     text not null unique,
  buyer_name      text,
  buyer_email     text,
  buyer_gstin     text,
  buyer_state     text,
  place_of_supply text,
  taxable_minor   integer not null,
  cgst_minor      integer not null default 0,
  sgst_minor      integer not null default 0,
  igst_minor      integer not null default 0,
  total_minor     integer not null,
  seller          jsonb not null,                -- name, address, GSTIN, state at issue time
  issued_at       timestamptz not null default now(),
  unique (fy, fy_seq)
);

-- ---------------------------------------------------------------- functions

-- Paid access: an active subscription that has not ended.
create or replace function upsc.has_access(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from upsc.subscriptions s
    where s.user_id = uid and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

create or replace function upsc.free_limit()
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select free_card_limit from upsc.courses order by created_at limit 1), 200);
$$;

-- Course size for the planner (counts locked cards too; RLS hides their content).
create or replace function upsc.course_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'total_cards', (select count(*) from upsc.cards),
    'free_limit', upsc.free_limit(),
    'has_access', upsc.has_access(auth.uid()));
$$;

-- Saves one rating in one transaction: FSRS state, the review log and the sitting position.
create or replace function upsc.save_rating(
  p_card_id text, p_state jsonb, p_rating smallint, p_mode text, p_seconds integer,
  p_sitting_id uuid, p_position integer
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  insert into upsc.card_state as cs (
    user_id, card_id, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses,
    state, last_review, last_rating, recent, ever_tough, tough_streak, honesty_misses, honesty_due, updated_at)
  values (
    auth.uid(), p_card_id, (p_state->>'due')::timestamptz, (p_state->>'stability')::float8,
    (p_state->>'difficulty')::float8, (p_state->>'scheduled_days')::int, (p_state->>'learning_steps')::int,
    (p_state->>'reps')::int, (p_state->>'lapses')::int, (p_state->>'state')::smallint,
    (p_state->>'last_review')::timestamptz, p_rating,
    coalesce(array(select jsonb_array_elements_text(p_state->'recent')::smallint), '{}'),
    coalesce((p_state->>'ever_tough')::boolean, false), coalesce((p_state->>'tough_streak')::smallint, 0),
    coalesce((p_state->>'honesty_misses')::smallint, 0), (p_state->>'honesty_due')::timestamptz, now())
  on conflict (user_id, card_id) do update set
    due = excluded.due, stability = excluded.stability, difficulty = excluded.difficulty,
    scheduled_days = excluded.scheduled_days, learning_steps = excluded.learning_steps,
    reps = excluded.reps, lapses = excluded.lapses, state = excluded.state,
    last_review = excluded.last_review, last_rating = excluded.last_rating, recent = excluded.recent,
    ever_tough = excluded.ever_tough, tough_streak = excluded.tough_streak,
    honesty_misses = excluded.honesty_misses, honesty_due = excluded.honesty_due, updated_at = now();

  insert into upsc.review_log (user_id, card_id, rating, mode, seconds, sitting_id)
  values (auth.uid(), p_card_id, p_rating, p_mode, greatest(p_seconds, 0), p_sitting_id);

  if p_sitting_id is not null then
    update upsc.sittings set position = greatest(position, p_position)
    where id = p_sitting_id and user_id = auth.uid();
  end if;
end;
$$;

-- Deletes the learner's account and all their study data (account deletion page).
create or replace function upsc.delete_my_data()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from upsc.push_subscriptions where user_id = auth.uid();
  delete from upsc.card_state where user_id = auth.uid();
  delete from upsc.review_log where user_id = auth.uid();
  delete from upsc.sittings where user_id = auth.uid();
  delete from upsc.test_answers where user_id = auth.uid();
  delete from upsc.reports where user_id = auth.uid();
  delete from upsc.alert_log where user_id = auth.uid();
  delete from upsc.ai_usage where user_id = auth.uid();
  delete from upsc.learners where user_id = auth.uid();
  -- invoices and payments are kept: GST law requires keeping tax records.
end;
$$;

-- ---------------------------------------------------------------- RLS

alter table upsc.courses enable row level security;
alter table upsc.topics enable row level security;
alter table upsc.cards enable row level security;
alter table upsc.questions enable row level security;
alter table upsc.config enable row level security;
alter table upsc.learners enable row level security;
alter table upsc.card_state enable row level security;
alter table upsc.review_log enable row level security;
alter table upsc.sittings enable row level security;
alter table upsc.test_answers enable row level security;
alter table upsc.reports enable row level security;
alter table upsc.push_subscriptions enable row level security;
alter table upsc.alert_log enable row level security;
alter table upsc.ai_cache enable row level security;
alter table upsc.ai_usage enable row level security;
alter table upsc.ai_flags enable row level security;
alter table upsc.payment_orders enable row level security;
alter table upsc.subscriptions enable row level security;
alter table upsc.invoices enable row level security;

-- Public course info (landing page shows price and exam date).
create policy courses_read on upsc.courses for select to anon, authenticated using (true);
create policy topics_read on upsc.topics for select to authenticated using (true);
create policy config_read on upsc.config for select to authenticated using (key not like 'secret.%');

create policy cards_read on upsc.cards for select to authenticated
  using (seq <= upsc.free_limit() or upsc.has_access());
create policy questions_read on upsc.questions for select to authenticated
  using (seq <= upsc.free_limit() or upsc.has_access());

create policy learners_own on upsc.learners for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy card_state_own on upsc.card_state for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy review_log_read on upsc.review_log for select to authenticated using (user_id = auth.uid());
create policy review_log_insert on upsc.review_log for insert to authenticated with check (user_id = auth.uid());
create policy sittings_own on upsc.sittings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy test_answers_read on upsc.test_answers for select to authenticated using (user_id = auth.uid());
create policy test_answers_insert on upsc.test_answers for insert to authenticated with check (user_id = auth.uid());
create policy reports_read on upsc.reports for select to authenticated using (user_id = auth.uid());
create policy push_own on upsc.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_cache_read on upsc.ai_cache for select to authenticated using (not withdrawn);
create policy ai_flags_insert on upsc.ai_flags for insert to authenticated with check (user_id = auth.uid());
create policy payment_orders_read on upsc.payment_orders for select to authenticated using (user_id = auth.uid());
create policy subscriptions_read on upsc.subscriptions for select to authenticated using (user_id = auth.uid());
create policy invoices_read on upsc.invoices for select to authenticated using (user_id = auth.uid());

grant select on upsc.courses to anon;
grant select on all tables in schema upsc to authenticated;
grant insert, update, delete on upsc.learners, upsc.card_state, upsc.sittings, upsc.push_subscriptions to authenticated;
grant insert on upsc.review_log, upsc.test_answers, upsc.ai_flags to authenticated;
grant all on all tables in schema upsc to service_role;
grant usage, select on all sequences in schema upsc to authenticated, service_role;
grant execute on function upsc.has_access(uuid), upsc.free_limit(), upsc.course_stats(), upsc.save_rating(text, jsonb, smallint, text, integer, uuid, integer), upsc.delete_my_data() to authenticated;
revoke execute on function upsc.delete_my_data() from anon;

-- ---------------------------------------------------------------- seed

insert into upsc.courses (id, title, exam_name, exam_date, exam_status, exam_source, exam_checked_at,
  list_price_minor, offer_price_minor, offer_label, free_card_limit)
values ('upsc_prelims_2027',
  '{"en": "Algo UPSC — Prelims 2027", "hi": "एल्गो यूपीएससी — प्रारंभिक परीक्षा 2027"}',
  'UPSC Civil Services (Preliminary) Examination 2027', '2027-05-23', 'official',
  'https://upsc.gov.in/examinations/exam-calendar (UPSC Calendar 2027, released 21 May 2026)', '2026-10-28',
  1000000, 300000, 'Introductory offer', 200);

insert into upsc.config (key, value) values
  ('retention', '0.9'),
  ('sitting_max', '10'),
  ('min_new_per_day', '5'),
  ('bonus_gap_minutes', '90'),
  ('bonus_per_day', '2'),
  ('honesty_rate', '0.2'),
  ('ai_daily_limit', '40'),
  ('ai_model_fast', '"claude-haiku-5-5"'),
  ('ai_model_strong', '"claude-sonnet-5-5"');

-- Analytics & instrumentation — §14.
--
-- §14 exists "to make §12.B2's 'prioritize usage_context by scan frequency' a
-- real mechanism rather than a sentence with nothing behind it". This is the
-- smallest thing that does that, first-party, so no third-party SDK or
-- privacy-policy change is needed to start collecting the signal. PostHog or
-- Amplitude (§14's suggestions) can replace it later; the event names match.
--
-- PRIVACY (§14, §15): there is no user column, no install id, no photo, and no
-- chat text. An event is an event type plus, at most, an ingredient id, a
-- product barcode, an outcome and a duration. Nothing here can rebuild one
-- person's shopping or health history.

create table if not exists public.app_events (
  id            bigint generated always as identity primary key,
  event         text not null check (event in (
                  'scan_outcome',          -- every scan attempt and how it ended
                  'card_expanded',         -- THE scan-frequency signal (§12.B2)
                  'chat_opened',           -- which product a chat was attached to
                  'chat_question',         -- one per question; never the text
                  'onboarding_completed',
                  'first_scan_completed'   -- carries seconds since onboarding
                )),
  outcome       text check (outcome is null or outcome in (
                  'barcode_resolved', 'ocr_succeeded', 'manual_search_used',
                  'not_found', 'no_ingredients', 'offline', 'ocr_unreadable', 'lookup_failed')),
  ingredient_id text check (ingredient_id is null or char_length(ingredient_id) <= 120),
  barcode       text check (barcode is null or barcode ~ '^[0-9]{6,14}$'),
  seconds       integer check (seconds is null or seconds between 0 and 31536000),
  occurred_at   timestamptz not null default now()
);
create index if not exists app_events_event_idx on public.app_events (event, occurred_at);
create index if not exists app_events_ingredient_idx on public.app_events (ingredient_id) where ingredient_id is not null;

create or replace function public.record_app_event(
  event text, outcome text default null, ingredient_id text default null,
  barcode text default null, seconds integer default null
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.app_events (event, outcome, ingredient_id, barcode, seconds)
  values (event, outcome, ingredient_id, barcode, seconds);
$$;

-- §12.B2: "Prioritize by expected scan frequency … refined by real usage data".
-- Ingredients people actually open, most-opened first, with whether a dosage
-- context exists yet. The top of this list is the research backlog.
create or replace view public.dosage_research_queue
with (security_invoker = true) as
  select i.id,
         i.canonical_name,
         count(e.id)                 as card_expansions,
         max(e.occurred_at)          as last_opened,
         i.usage_context is not null as has_dosage_context
    from public.app_events e
    join public.ingredients i on i.id = e.ingredient_id
   where e.event = 'card_expanded'
   group by i.id, i.canonical_name, i.usage_context
   order by (i.usage_context is not null), count(e.id) desc;

-- §4's "always give the user an out": where the scan funnel actually breaks.
create or replace view public.scan_funnel
with (security_invoker = true) as
  select date_trunc('week', occurred_at) as week, outcome, count(*) as scans
    from public.app_events
   where event = 'scan_outcome'
   group by 1, 2
   order by 1 desc, 3 desc;

alter table public.app_events enable row level security;
-- No policy: only record_app_event (security definer) writes; only the
-- service role reads.
revoke all on public.app_events from anon, authenticated;
revoke all on public.dosage_research_queue, public.scan_funnel from anon, authenticated;
grant execute on function public.record_app_event(text, text, text, text, integer) to anon, authenticated;

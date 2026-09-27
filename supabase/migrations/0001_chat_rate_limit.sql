-- Per-user rate limiting for the ingredient chat assistant.
--
-- §8: "budget and rate-limit this explicitly (see §7 and §8) rather than
-- treating it as free once the database and screens are built."
--
-- This lives in Postgres rather than in the Edge Function's memory because
-- Edge Functions are not a single long-lived process — an in-memory counter
-- resets on every cold start and is not shared between instances, so it would
-- not actually limit anything.

create table if not exists public.chat_usage (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  message_count int       not null default 0,
  primary key (user_id, window_start)
);

-- Nobody reads this table from the client; the Edge Function uses the service
-- role. RLS on with no policy means no client-side access at all.
alter table public.chat_usage enable row level security;

/**
 * Count one message against the caller's quota and report what's left.
 * Returns the number of messages still allowed in the current window.
 * A negative result means the caller is over the limit.
 */
create or replace function public.consume_chat_quota(
  p_user_id uuid,
  p_limit   int,
  p_window  interval
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz := date_trunc('hour', now());
  v_count        int;
begin
  insert into public.chat_usage (user_id, window_start, message_count)
  values (p_user_id, v_window_start, 1)
  on conflict (user_id, window_start)
    do update set message_count = public.chat_usage.message_count + 1
  returning message_count into v_count;

  -- Old windows are dead weight; clear them opportunistically.
  delete from public.chat_usage
   where window_start < now() - (p_window * 3);

  return p_limit - v_count;
end;
$$;

-- Explicit grants, so this migration does not depend on a project-level
-- dashboard toggle ("Automatically expose new tables") being set either way.
--
-- The Edge Function calls this with the service role. Nothing here is reachable
-- from the app: chat_usage has RLS on with no policy, and neither the table nor
-- the function is granted to anon or authenticated.
grant execute on function public.consume_chat_quota(uuid, int, interval) to service_role;
revoke execute on function public.consume_chat_quota(uuid, int, interval) from anon, authenticated;
revoke all on table public.chat_usage from anon, authenticated;

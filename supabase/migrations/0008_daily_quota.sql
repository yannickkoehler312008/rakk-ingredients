-- A daily cap on every metered capability, on top of the hourly one.
--
-- The hourly limits (30 questions, 20 photos, 120 product lookups) stop a
-- burst, but not a determined user: 30 an hour is 720 a day. Each capability
-- now also has a rolling-24-hour cap, so the most one anonymous user can cost
-- in a day is bounded. Rolling rather than "per calendar day" because a
-- calendar day starts at a different hour in Hong Kong and the US, and the app
-- can then say truthfully that the allowance frees up over the next 24 hours.
--
-- Counts are kept in the existing hourly rows; the day total is their sum over
-- the last 24 hours, so rows now live two days instead of three hours.

create or replace function public.consume_quotas(
  p_user_id    uuid,
  p_kind       text,
  p_hour_limit int,
  p_day_limit  int
) returns table (hour_left int, day_left int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hour int;
  v_day  int;
begin
  insert into public.chat_usage (user_id, window_start, kind, message_count)
  values (p_user_id, date_trunc('hour', now()), p_kind, 1)
  on conflict (user_id, window_start, kind)
    do update set message_count = public.chat_usage.message_count + 1
  returning message_count into v_hour;

  select coalesce(sum(message_count), 0)::int into v_day
    from public.chat_usage
   where user_id = p_user_id
     and kind = p_kind
     and window_start > now() - interval '24 hours';

  delete from public.chat_usage where window_start < now() - interval '2 days';

  return query select p_hour_limit - v_hour, p_day_limit - v_day;
end;
$$;

-- The original hourly function must not delete the rows the daily sum needs.
create or replace function public.consume_quota(
  p_user_id uuid,
  p_kind    text,
  p_limit   int,
  p_window  interval
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.chat_usage (user_id, window_start, kind, message_count)
  values (p_user_id, date_trunc('hour', now()), p_kind, 1)
  on conflict (user_id, window_start, kind)
    do update set message_count = public.chat_usage.message_count + 1
  returning message_count into v_count;

  delete from public.chat_usage where window_start < now() - interval '2 days';

  return p_limit - v_count;
end;
$$;

grant execute on function public.consume_quotas(uuid, text, int, int) to service_role;
revoke execute on function public.consume_quotas(uuid, text, int, int) from anon, authenticated;

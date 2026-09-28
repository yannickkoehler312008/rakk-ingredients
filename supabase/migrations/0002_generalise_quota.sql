-- Generalise the per-user quota so each paid capability is metered separately.
--
-- §8 requires costed capabilities to be rate-limited explicitly. Step 6 adds a
-- second one: reading a photographed ingredient panel is a vision call, which
-- costs money per scan. Sharing one counter with the chat would mean scanning
-- eats the user's chat allowance, which is not what either limit is for.
--
-- Additive: the existing column keeps its name and the chat keeps working
-- through the old function, which now delegates.

alter table public.chat_usage
  add column if not exists kind text not null default 'chat';

-- The counter is per (user, hour, capability).
alter table public.chat_usage drop constraint if exists chat_usage_pkey;
alter table public.chat_usage add primary key (user_id, window_start, kind);

/**
 * Count one use of `p_kind` against the caller's quota and report what's left.
 * Negative means over the limit.
 */
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
  v_window_start timestamptz := date_trunc('hour', now());
  v_count        int;
begin
  insert into public.chat_usage (user_id, window_start, kind, message_count)
  values (p_user_id, v_window_start, p_kind, 1)
  on conflict (user_id, window_start, kind)
    do update set message_count = public.chat_usage.message_count + 1
  returning message_count into v_count;

  delete from public.chat_usage
   where window_start < now() - (p_window * 3);

  return p_limit - v_count;
end;
$$;

-- The original chat function now delegates, so the deployed chat endpoint
-- keeps working unchanged while both share one implementation.
create or replace function public.consume_chat_quota(
  p_user_id uuid,
  p_limit   int,
  p_window  interval
) returns int
language sql
security definer
set search_path = public
as $$
  select public.consume_quota(p_user_id, 'chat', p_limit, p_window);
$$;

grant execute on function public.consume_quota(uuid, text, int, interval) to service_role;
revoke execute on function public.consume_quota(uuid, text, int, interval) from anon, authenticated;

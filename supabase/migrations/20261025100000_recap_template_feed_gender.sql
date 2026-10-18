-- Cleanup after 1.5.0: the template id in the weekly family recap, the kid's gender in the Inbox feed.
-- Copied from their latest definitions; only these are added:
--   private.enqueue_recaps       20261013100000_recaps.sql: 'template' (habits.template_id) next to
--                                'title' in the family_recap payload's best. Stored payloads keep only
--                                their title.
--   private.inbox_feed_impl,     20261024100000_habit_template_id.sql: subject_gender (profiles.gender of
--   public.inbox_feed            the row's subject). Every kid kind (kid_check_in, kid_streak,
--                                kid_goal_reached, kid_garden_full, already_logged) stores the kid as its
--                                subject; the actor is the adult who logged it, if any.

create or replace function private.enqueue_recaps(p_now timestamptz)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_user record;
  v_group record;
  v_best record;
  v_today date;
  v_end_at timestamptz;
  v_recap jsonb;
  v_month date;
  v_ws date;
  v_count int;
  v_claimed boolean;
  v_n int := 0;
begin
  delete from public.recap_runs r where r.period_start < (p_now - interval '62 days')::date;

  for v_user in select p.id, p.timezone, p.week_start from public.profiles p where p.kind = 'adult' order by p.id loop
    begin
      v_today := private.local_date(p_now, v_user.timezone);
      continue when p_now < private.local_instant(v_today, time '10:00', v_user.timezone);
      if private.period_start('week', v_today, v_user.week_start) = v_today then
        v_claimed := false;
        insert into public.recap_runs (user_id, kind, period_start, processed_at)
        values (v_user.id, 'weekly_recap', v_today - 7, p_now)
        on conflict do nothing returning true into v_claimed;
        if v_claimed is true then
          v_recap := private.recap_impl(v_user.id, 'week', v_today - 7, p_now);
          if (v_recap ->> 'done')::int > 0 then
            v_n := v_n + private.notify_count(array[v_user.id], 'weekly_recap', 'weekly_recap:' || (v_today - 7),
              null, null, null, null, null, v_recap);
          end if;
        end if;
      end if;
      if extract(day from v_today) = 1 then
        v_month := (v_today - interval '1 month')::date;
        v_claimed := false;
        insert into public.recap_runs (user_id, kind, period_start, processed_at)
        values (v_user.id, 'monthly_recap', v_month, p_now)
        on conflict do nothing returning true into v_claimed;
        if v_claimed is true then
          v_recap := private.recap_impl(v_user.id, 'month', v_month, p_now);
          if (v_recap ->> 'done')::int > 0 then
            v_n := v_n + private.notify_count(array[v_user.id], 'monthly_recap', 'monthly_recap:' || v_month,
              null, null, null, null, null, v_recap);
          end if;
        end if;
      end if;
    exception when others then
      raise warning 'enqueue_recaps: person %: % (%)', v_user.id, sqlerrm, sqlstate;
    end;
  end loop;

  for v_group in select g.id, g.timezone, g.week_start from public.groups g order by g.id loop
    begin
      v_today := private.local_date(p_now, v_group.timezone);
      continue when p_now < private.local_instant(v_today, time '10:00', v_group.timezone)
                 or private.period_start('week', v_today, v_group.week_start) <> v_today;
      v_ws := v_today - 7;
      v_claimed := false;
      insert into public.recap_runs (group_id, kind, period_start, processed_at)
      values (v_group.id, 'family_recap', v_ws, p_now)
      on conflict do nothing returning true into v_claimed;
      continue when v_claimed is not true;  -- no row returned: already processed
      -- Same count as the Inbox card (private.family_recaps_impl).
      select count(*)::int into v_count from public.check_ins c join public.habits h on h.id = c.habit_id
       where h.group_id = v_group.id and c.status = 'approved' and c.local_date >= v_ws and c.local_date < v_today;
      continue when v_count = 0;
      -- The longest group streak as the week ended (as recap_impl reads it), ended habits left out.
      v_end_at := least(private.local_midnight(v_today, v_group.timezone) - interval '1 microsecond', p_now);
      select h.title, h.template_id, h.period, st.current_streak into v_best
        from public.habits h cross join lateral private.habit_streaks(h.id, v_end_at) st
       where h.group_id = v_group.id and st.current_streak > 0
         and (h.archived_at is null or h.archived_at > v_end_at)
         and (h.ends_on is null or h.ends_on >= v_ws)
       order by st.current_streak desc, h.created_at limit 1;
      v_n := v_n + private.notify_count(
        array(select a from unnest(private.group_adults(v_group.id, null)) a order by a),
        'family_recap', 'family_recap:' || v_group.id || ':' || v_ws,
        v_group.id, null, null, null, null,
        jsonb_build_object('week_start', v_ws, 'check_ins', v_count,
          'best', case when v_best.title is null then null
                       else jsonb_build_object('title', v_best.title, 'template', v_best.template_id, 'length', v_best.current_streak, 'period', v_best.period) end));
    exception when others then
      raise warning 'enqueue_recaps: group %: % (%)', v_group.id, sqlerrm, sqlstate;
    end;
  end loop;
  return v_n;
end;
$$;

drop function public.inbox_feed(int);
drop function private.inbox_feed_impl(uuid, int);
create function private.inbox_feed_impl(p_user uuid, p_limit int)
returns table (
  id uuid, kind text, created_at timestamptz, read_at timestamptz, seen_at timestamptz,
  group_id uuid, group_name text, habit_id uuid, habit_title text, habit_emoji text, check_in_id uuid,
  actor_name text, actor_avatar_emoji text, actor_avatar_color text,
  subject_id uuid, subject_name text, subject_avatar_emoji text, payload jsonb, habit_template text,
  subject_gender text)
language sql
stable
set search_path = ''
as $$
  select n.id, n.kind, n.created_at, n.read_at, n.seen_at, n.group_id, g.name, n.habit_id, h.title, h.emoji, n.check_in_id,
         a.display_name, a.avatar_emoji, a.avatar_color, n.subject_id, s.display_name, s.avatar_emoji, n.payload, h.template_id,
         s.gender
    from public.notifications n
    left join public.groups g on g.id = n.group_id
    left join public.habits h on h.id = n.habit_id
    left join public.profiles a on a.id = n.actor_id
    left join public.profiles s on s.id = n.subject_id
   where n.user_id = p_user
   order by n.created_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;
create function public.inbox_feed(p_limit int default 50)
returns table (
  id uuid, kind text, created_at timestamptz, read_at timestamptz, seen_at timestamptz,
  group_id uuid, group_name text, habit_id uuid, habit_title text, habit_emoji text, check_in_id uuid,
  actor_name text, actor_avatar_emoji text, actor_avatar_color text,
  subject_id uuid, subject_name text, subject_avatar_emoji text, payload jsonb, habit_template text,
  subject_gender text)
language sql stable security definer set search_path = '' as $$
  select * from private.inbox_feed_impl(auth.uid(), p_limit);
$$;
revoke execute on function public.inbox_feed(int) from public, anon;
grant execute on function public.inbox_feed(int) to authenticated;

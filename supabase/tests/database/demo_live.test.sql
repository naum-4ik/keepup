begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

-- The demo looks live on any day, in the visitor's language (20261026100000_demo_live.sql).

-- The app passes the group and treat names in the visitor's language.
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000007a1');
select tests.authenticate_as('00000000-0000-0000-0000-0000000007a1');
select lives_ok($$select public.start_demo('Europe/Berlin', 'Семья', 'Поход на детскую площадку')$$, 'start_demo takes the group and treat names');
-- The Inbox as the app reads it (lib/feed-copy.ts): kind, actor, habit, group and the nudge's kind.
select is((select string_agg(kind || ' ' || actor_name || ' ' || habit_title || ' ' || group_name || ' ' || payload::text, ' | ' order by created_at desc)
             from public.inbox_feed() where kind in ('nudge', 'cheer')),
          'nudge Alex Family walk Семья {"kind": "you_got_this"} | cheer Alex Family walk Семья {}', 'Inbox: Alex''s nudge and cheer, as feed-copy reads them');
select ok((select bool_and(read_at is null and seen_at is null) from public.inbox_feed() where kind in ('nudge', 'cheer')), 'both unread');
select ok((select check_in_id is not null from public.inbox_feed() where kind = 'cheer'), 'the cheer points at a check-in');
reset role;
create temp table v as
  select p.id as nova, p.group_id as grp from public.profiles p
   where p.kind = 'child' and p.group_id in (select m.group_id from public.group_members m where m.user_id = '00000000-0000-0000-0000-0000000007a1');
select is((select g.name from public.groups g join v on v.grp = g.id), 'Семья', 'group named from the param');
select is((select t.title || ' ' || t.emoji from public.treat_goals t join v on v.nova = t.child_id), 'Поход на детскую площадку 🛝', 'treat named from the param');
select is((select p.gender from public.profiles p join v on v.nova = p.id), 'girl', 'Nova is a girl');
select is((select string_agg(h.title || '=' || coalesce(h.template_id, '-'), ', ' order by h.title) from public.habits h
            where h.owner_id in ('00000000-0000-0000-0000-0000000007a1', (select nova from v)) or h.group_id = (select grp from v)),
          'Brush teeth=kid.brush-teeth, Drink water=water, Family dinner=g-family-dinner, Family walk=g-family-walk, Meditate=meditate, '
          || 'Read 20 min=read, Read a book together=kid.read-together, Tidy my toys=kid.tidy-toys, Walk=-',
          'every template habit carries its template; only Walk is typed');
select is((select h.emoji || ' ' || h.target_count || '/' || h.period from public.habits h where h.group_id = (select grp from v) and h.title = 'Family walk'),
          '🚶 2/week', 'Family walk keeps 🚶, twice a week');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000007a1' and kind in ('nudge', 'cheer') and push), 0,
          'the nudge and the cheer are not pushed');
select is((select count(*)::int from public.nudges where recipient_id = '00000000-0000-0000-0000-0000000007a1'), 1, 'the nudge is a real nudges row');
select is((select count(*)::int from public.cheers c join public.check_ins ci on ci.id = c.check_in_id
            where ci.user_id = '00000000-0000-0000-0000-0000000007a1'), 1, 'the cheer is a real cheers row');
select is((select count(*)::int from public.notifications n join public.profiles p on p.id = n.user_id
            where p.display_name = 'Alex' and p.id in (select user_id from public.group_members where group_id = (select grp from v))), 0,
          'nothing waits in Alex''s feed');

-- Callers without the new params keep the English names; names the tables would refuse fall back.
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000007a2');
select tests.authenticate_as('00000000-0000-0000-0000-0000000007a2');
select public.start_demo('Europe/Berlin');
reset role;
select is((select g.name || ' / ' || t.title from public.groups g join public.profiles c on c.group_id = g.id and c.kind = 'child'
             join public.treat_goals t on t.child_id = c.id where g.created_by = '00000000-0000-0000-0000-0000000007a2'),
          'Family / Trip to the playground', 'defaults: Family and Trip to the playground');
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000007a3');
select private.start_demo_impl('00000000-0000-0000-0000-0000000007a3', 'Europe/Berlin', now(), '  ', repeat('x', 41));
select is((select g.name || ' / ' || char_length(t.title) from public.groups g join public.profiles c on c.group_id = g.id and c.kind = 'child'
             join public.treat_goals t on t.child_id = c.id where g.created_by = '00000000-0000-0000-0000-0000000007a3'),
          'Family / 40', 'a blank group name falls back; a long treat title is cut to fit');

-- Date-proof: Nova's week and the Inbox at fixed moments of next week (Mon 00:30, Wed 12:00, Sun 23:59 Berlin).
create function pg_temp.live_at(p_user uuid, p_now timestamptz, p_label text) returns setof text language plpgsql as $$
declare
  v_group uuid; v_nova uuid; v_today date; v_week date;
begin
  perform private.start_demo_impl(p_user, 'Europe/Berlin', p_now);
  v_group := (select id from public.groups where created_by = p_user);
  v_nova := (select id from public.profiles where kind = 'child' and group_id = v_group);
  v_today := (p_now at time zone 'Europe/Berlin')::date;
  v_week := private.period_start('week', v_today, 1::smallint);
  return next is((select count(*)::int from public.check_ins where user_id = v_nova and local_date >= v_today), 0,
                 p_label || ': no star for Nova today (the visitor taps those)');
  return next is((select count(*)::int from public.check_ins where user_id = v_nova and local_date between v_week and v_today - 1),
                 4 * (v_today - v_week), p_label || ': every slot of every elapsed day this week');
  return next is((select count(distinct local_date)::int from public.check_ins where user_id = v_nova and local_date between v_week and v_today - 1),
                 v_today - v_week, p_label || ': each elapsed day has stars');
  return next is((select count(*)::int from public.check_ins where user_id = v_nova and local_date between v_week - 7 and v_week - 1), 28,
                 p_label || ': last week full');
  -- By kind: the approval row is stamped by its trigger with the real clock, not p_now.
  return next is((select string_agg(kind, ', ' order by kind) from private.inbox_feed_impl(p_user, 50)),
                 'approval_needed, cheer, nudge', p_label || ': the Inbox: approval, cheer, nudge');
  return next ok((select bool_and(created_at between p_now - interval '6 hours' and p_now) from public.notifications
                   where user_id = p_user and kind in ('nudge', 'cheer')), p_label || ': nudge and cheer a few hours old');
  return next is((select count(*)::int from public.nudges where recipient_id = p_user and local_date <> v_today), 0,
                 p_label || ': the nudge is from today');
  return next ok((select n.created_at > c.created_at from public.notifications n join public.check_ins c on c.id = n.check_in_id
                   where n.user_id = p_user and n.kind = 'cheer'), p_label || ': the cheer comes after its check-in');
  return next is((select count(*)::int
                    from (select c.created_at from public.check_ins c join public.habits h on h.id = c.habit_id
                           where h.owner_id in (p_user, v_nova) or h.group_id = v_group
                          union all select n.created_at from public.notifications n where n.user_id = p_user
                          union all select u.created_at from public.nudges u where u.recipient_id = p_user
                          union all select c.created_at from public.cheers c join public.check_ins ci on ci.id = c.check_in_id where ci.user_id = p_user) x
                   where x.created_at > p_now), 0, p_label || ': nothing dated in the future');
  return next is(private.garden_stage((private.child_rewards_impl(p_user, v_nova, p_now)->>'stars_this_week')::int),
                 private.garden_stage(4 * (v_today - v_week)), p_label || ': the garden grows with the seeded week');
  return next is((select count(*)::int from public.period_results x join public.habits h on h.id = x.habit_id
                   where h.owner_id = v_nova and x.period_start >= v_week - 7 and x.outcome <> 'done'), 0,
                 p_label || ': Nova''s closed days are all done');
end; $$;
create temp table berlin as
  select date_trunc('week', now() at time zone 'Europe/Berlin')::date + 7 as mon,
         date_trunc('week', now() at time zone 'Europe/Berlin')::date + 9 as wed,
         date_trunc('week', now() at time zone 'Europe/Berlin')::date + 13 as sun;
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000007d1');
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000007d2');
select tests.create_anonymous_user('00000000-0000-0000-0000-0000000007d3');
select pg_temp.live_at('00000000-0000-0000-0000-0000000007d1', (mon + time '00:30') at time zone 'Europe/Berlin', 'Monday 00:30') from berlin;
select pg_temp.live_at('00000000-0000-0000-0000-0000000007d2', (wed + time '12:00') at time zone 'Europe/Berlin', 'Wednesday 12:00') from berlin;
select pg_temp.live_at('00000000-0000-0000-0000-0000000007d3', (sun + time '23:59') at time zone 'Europe/Berlin', 'Sunday 23:59') from berlin;

select * from finish();
rollback;

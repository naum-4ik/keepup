begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
update public.profiles set avatar_emoji = '🐻' where id = '00000000-0000-0000-0000-0000000000b1';

create temp table t (k text primary key, v uuid) on commit drop;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
update public.groups set avatar_emoji = '🏡', avatar_color = 'sage' where id = (select v from t where k = 'fam');
insert into t select 'inv', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), now())).id;

-- Invite landing with the group avatar.
select is((select row(avatar_emoji, avatar_color)::text from public.invite_preview((select token from public.group_invites where id = (select v from t where k = 'inv')))),
  '(🏡,sage)', 'the invite preview shows the group avatar');

select private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1', (select token from public.group_invites where id = (select v from t where k = 'inv')), now());

-- Inbox avatars: Anna's "Dan joined" row carries Dan's avatar.
select tests.authenticate_as('00000000-0000-0000-0000-0000000000a1');
select is((select actor_avatar_emoji from public.inbox_feed(50) where kind = 'member_joined'), '🐻', 'feed rows carry the actor''s avatar');
reset role;

-- A treat goal reached by a star that is then undone is not reached any more.
insert into t select 'mary', private.create_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'fam'), 'Mary', '🐼', 'peach', true);
set local session_replication_role = replica;
insert into public.habits (id, owner_id, title, category, emoji, target_count, period, starts_on, week_start, created_at, created_by)
values ('00000000-0000-0000-0000-0000000000d1', (select v from t where k = 'mary'), 'Brush teeth', null, '🪥', 1, 'day', current_date - 2, 1,
        now() - interval '2 days', '00000000-0000-0000-0000-0000000000a1');
set local session_replication_role = origin;
select private.set_treat_goal_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary'), 'Park', '🛝', 2);
select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', now(), (select v from t where k = 'mary'));
insert into t select 'star2', (private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', now() + interval '1 day', (select v from t where k = 'mary'))).id;
select ok((select reached_at is not null from public.treat_goals where child_id = (select v from t where k = 'mary')), 'setup: two stars reach the goal');
select private.undo_check_in_impl((select v from t where k = 'star2'), '00000000-0000-0000-0000-0000000000a1', now() + interval '1 day');
select ok((select reached_at is null from public.treat_goals where child_id = (select v from t where k = 'mary')), 'undoing a star un-reaches the goal');

-- Export: a check-in logged by an adult who later deletes their account is not "by the child".
select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', now() + interval '2 days', (select v from t where k = 'mary'), true);
select private.check_in_impl('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', now() + interval '3 days', (select v from t where k = 'mary'));
delete from auth.users where id = '00000000-0000-0000-0000-0000000000b1';
select is((select count(*)::int from jsonb_array_elements(private.export_child_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'mary')) -> 'check_ins') e
            where (e ->> 'by_child')::boolean), 1, 'only the kid-view tap is by the child, even after the logging adult left');
select is((select count(*)::int from public.check_ins where by_child and user_id = (select v from t where k = 'mary')), 1, 'by_child is recorded when the check-in is made');

-- Joining holds the group, so a racing last leave can't leave a dangling member row.
select ok(pg_get_functiondef('private.accept_invite_impl(uuid,text,timestamptz)'::regprocedure) ~ 'for share', 'accept_invite holds the group row');

select * from finish();
rollback;

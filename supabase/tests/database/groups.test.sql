begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'anna@example.com', '{"full_name":"Anna Levi"}');
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'carol@example.com', '{"full_name":"Carol"}');
select tests.create_user('00000000-0000-0000-0000-0000000000f1', 'fay@example.com', '{"full_name":"Fay"}');
select tests.create_user('00000000-0000-0000-0000-0000000000e1', 'eve@example.com', '{"full_name":"Eve"}');
update public.profiles set timezone = 'Asia/Jerusalem', week_start = 0 where id = '00000000-0000-0000-0000-0000000000a1';

create temp table t (k text primary key, v text) on commit drop;
grant all on t to authenticated;

-- Creating a group
insert into t select 'g', (private.create_group_impl('00000000-0000-0000-0000-0000000000a1', 'Family', 'family')).id;
select is((select name from public.groups where id = (select v::uuid from t where k = 'g')), 'Family', 'a group is created with its name');
select is((select timezone || '/' || week_start from public.groups where id = (select v::uuid from t where k = 'g')),
  'Asia/Jerusalem/0', 'the group copies the creator''s time zone and week start');
select is((select role from public.group_members where group_id = (select v::uuid from t where k = 'g') and user_id = '00000000-0000-0000-0000-0000000000a1'),
  'admin', 'the creator is the first admin');
select throws_ok($$select private.create_group_impl('00000000-0000-0000-0000-0000000000a1', '   ', 'family')$$,
  '23514', null, 'a blank name is refused');
select throws_ok($$select private.create_group_impl('00000000-0000-0000-0000-0000000000a1', rpad('x', 41, 'x'), 'family')$$,
  '23514', null, 'a 41-character name is refused');

-- Invites
insert into t select 'tok', (private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'g'), '2026-10-01T08:00:00Z')).token;
select is((private.create_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'g'), '2026-10-02T08:00:00Z')).token,
  (select v from t where k = 'tok'), 'an active invite is reused, not duplicated');
select ok(length((select v from t where k = 'tok')) >= 24, 'invite tokens are long and random');
select throws_ok($$select private.create_invite_impl('00000000-0000-0000-0000-0000000000c1', (select v::uuid from t where k = 'g'), '2026-10-01T08:00:00Z')$$,
  'P0002', 'keepup:group_not_found', 'an outsider cannot create an invite');

select results_eq($$select group_name, group_kind, inviter_name, member_count from private.invite_preview_impl((select v from t where k = 'tok'), '2026-10-01T08:30:00Z')$$,
  $$values ('Family'::text, 'family'::text, 'Anna'::text, 1)$$, 'the preview shows the group, the inviter''s first name and the size');
select is_empty($$select * from public.invite_preview('not-a-token')$$, 'an unknown token previews nothing');
-- (Every rule call in this file pins its time; the real clock is used only where the answer can't
-- depend on it.)

-- Accepting
select is(private.accept_invite_impl('00000000-0000-0000-0000-0000000000b1', (select v from t where k = 'tok'), '2026-10-01T09:00:00Z'),
  (select v::uuid from t where k = 'g'), 'accepting returns the group');
select is((select role from public.group_members where group_id = (select v::uuid from t where k = 'g') and user_id = '00000000-0000-0000-0000-0000000000b1'),
  'member', 'the invitee joins as a member');
select lives_ok($$select private.accept_invite_impl('00000000-0000-0000-0000-0000000000a1', (select v from t where k = 'tok'), '2026-10-01T09:00:00Z')$$,
  'accepting a group you are already in is harmless');
select is((select role from public.group_members where group_id = (select v::uuid from t where k = 'g') and user_id = '00000000-0000-0000-0000-0000000000a1'),
  'admin', 'and an admin who opens their own link stays admin');
select throws_ok($$select private.accept_invite_impl('00000000-0000-0000-0000-0000000000e1', (select v from t where k = 'tok'), '2026-10-09T08:00:01Z')$$,
  'P0001', 'keepup:invite_invalid', 'an invite expires after 7 days');

-- Roles
select throws_ok($$select private.set_member_role_impl('00000000-0000-0000-0000-0000000000b1', (select v::uuid from t where k = 'g'), '00000000-0000-0000-0000-0000000000b1', 'admin')$$,
  'P0001', 'keepup:not_admin', 'a member cannot promote themselves');
select throws_ok($$select private.set_member_role_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'g'), '00000000-0000-0000-0000-0000000000a1', 'member')$$,
  'P0001', 'keepup:last_admin', 'the last admin cannot step down');
select throws_ok($$select private.leave_group_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'g'), false, '2026-10-01T10:00:00Z')$$,
  'P0001', 'keepup:last_admin', 'the last admin cannot leave while others remain');
select lives_ok($$select private.set_member_role_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'g'), '00000000-0000-0000-0000-0000000000b1', 'admin')$$,
  'an admin promotes a member');
select lives_ok($$select private.set_member_role_impl('00000000-0000-0000-0000-0000000000a1', (select v::uuid from t where k = 'g'), '00000000-0000-0000-0000-0000000000a1', 'member')$$,
  'with a second admin, the first may step down');

-- Revoking, rejoining, removing
select lives_ok($$select private.revoke_invites_impl('00000000-0000-0000-0000-0000000000b1', (select v::uuid from t where k = 'g'), '2026-10-01T11:00:00Z')$$,
  'an admin revokes the invite link');
select throws_ok($$select private.accept_invite_impl('00000000-0000-0000-0000-0000000000e1', (select v from t where k = 'tok'), '2026-10-01T12:00:00Z')$$,
  'P0001', 'keepup:invite_invalid', 'a revoked invite is refused');
insert into t select 'tok2', (private.create_invite_impl('00000000-0000-0000-0000-0000000000b1', (select v::uuid from t where k = 'g'), '2026-10-01T12:00:00Z')).token;
select isnt((select v from t where k = 'tok2'), (select v from t where k = 'tok'), 'a new link after revoking is a new token');
select lives_ok($$select private.accept_invite_impl('00000000-0000-0000-0000-0000000000e1', (select v from t where k = 'tok2'), '2026-10-01T12:30:00Z')$$, 'Eve joins');
select throws_ok($$select private.remove_member_impl('00000000-0000-0000-0000-0000000000e1', (select v::uuid from t where k = 'g'), '00000000-0000-0000-0000-0000000000a1', '2026-10-01T13:00:00Z')$$,
  'P0001', 'keepup:not_admin', 'a member cannot remove others');
select throws_ok($$select private.create_invite_impl('00000000-0000-0000-0000-0000000000e1', (select v::uuid from t where k = 'g'), '2026-10-01T13:00:00Z')$$,
  'P0001', 'keepup:not_admin', 'a plain member cannot create an invite');
select lives_ok($$select private.remove_member_impl('00000000-0000-0000-0000-0000000000b1', (select v::uuid from t where k = 'g'), '00000000-0000-0000-0000-0000000000e1', '2026-10-01T13:00:00Z')$$,
  'an admin removes a member');
select ok((select left_at is not null from public.group_members where group_id = (select v::uuid from t where k = 'g') and user_id = '00000000-0000-0000-0000-0000000000e1'),
  'removal keeps the row with left_at (history stays)');
select lives_ok($$select private.accept_invite_impl('00000000-0000-0000-0000-0000000000e1', (select v from t where k = 'tok2'), '2026-10-01T14:00:00Z')$$, 'a removed member can rejoin by link');
select results_eq($$select role, left_at is null, joined_at from public.group_members where group_id = (select v::uuid from t where k = 'g') and user_id = '00000000-0000-0000-0000-0000000000e1'$$,
  $$values ('member'::text, true, '2026-10-01T14:00:00Z'::timestamptz)$$, 'rejoining clears left_at and sets a new joined_at');

-- RLS: members read the group; outsiders and ex-members don't
select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select is_empty($$select * from public.groups$$, 'an outsider cannot read the group');
select is_empty($$select * from public.group_members$$, 'or its members');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from public.group_members), 3, 'a member reads the member list');
select is_empty($$select * from public.group_invites$$, 'a member who is not an admin cannot read invite tokens');
reset role;
select tests.authenticate_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$select public.set_member_role((select v::uuid from t where k = 'g'), '00000000-0000-0000-0000-0000000000e1', null)$$,
  'P0001', 'keepup:invalid_role', 'a null role is refused');
reset role;

-- Deleting: the last adult with children must confirm
set local session_replication_role = replica;
insert into public.profiles (id, display_name, kind, group_id)
values ('00000000-0000-0000-0000-00000000c0de', 'Mary', 'child', (select v::uuid from t where k = 'g'));
set local session_replication_role = origin;
select throws_ok($$select private.delete_group_impl('00000000-0000-0000-0000-0000000000b1', (select v::uuid from t where k = 'g'), false)$$,
  'P0001', 'keepup:children_would_be_deleted', 'deleting a group with children needs confirmation');

-- Deleting an auth user deletes the adult's profile and, through it, their habits and check-ins.
-- Fixed dates with triggers off: the habit rules' "no start in the past" reads the owner's own today,
-- which UTC current_date isn't, in some hours.
set local session_replication_role = replica;
insert into public.habits (owner_id, title, category, emoji, target_count, period, starts_on, created_at)
values ('00000000-0000-0000-0000-0000000000f1', 'Read', 'learning', '📚', 1, 'day', '2026-09-01', '2026-09-01T08:00:00Z');
insert into public.check_ins (habit_id, user_id, local_date, period_start, created_at, logged_by)
select id, owner_id, '2026-09-01', '2026-09-01', '2026-09-01T09:00:00Z', owner_id from public.habits where owner_id = '00000000-0000-0000-0000-0000000000f1';
set local session_replication_role = origin;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000f1';
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'), 0,
  'deleting an auth user deletes the profile');
select is((select count(*)::int from public.habits where owner_id = '00000000-0000-0000-0000-0000000000f1'), 0,
  'and their habits');
select is((select count(*)::int from public.check_ins where user_id = '00000000-0000-0000-0000-0000000000f1'), 0,
  'and their check-ins');

select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Anna: admin of Family (Ben joined first, Cara later), sole member of Solo (with child Leo),
-- co-admin of Club (Dan is admin too), and in Book with Eve who has left.
select tests.create_user('00000000-0000-0000-0000-0000000004a1', 'del-anna@example.com', '{"full_name":"Anna"}');
select tests.create_user('00000000-0000-0000-0000-0000000004b1', 'del-ben@example.com', '{"full_name":"Ben"}');
select tests.create_user('00000000-0000-0000-0000-0000000004c1', 'del-cara@example.com', '{"full_name":"Cara"}');
select tests.create_user('00000000-0000-0000-0000-0000000004d1', 'del-dan@example.com', '{"full_name":"Dan"}');
select tests.create_user('00000000-0000-0000-0000-0000000004e1', 'del-eve@example.com', '{"full_name":"Eve"}');
create temp table t (k text primary key, v uuid) on commit drop;
grant all on t to authenticated;
insert into t select 'fam', (private.create_group_impl('00000000-0000-0000-0000-0000000004a1', 'Family', 'family')).id;
insert into t select 'solo', (private.create_group_impl('00000000-0000-0000-0000-0000000004a1', 'Solo', 'other')).id;
insert into t select 'club', (private.create_group_impl('00000000-0000-0000-0000-0000000004a1', 'Club', 'friends')).id;
insert into t select 'book', (private.create_group_impl('00000000-0000-0000-0000-0000000004a1', 'Book', 'friends')).id;
create function pg_temp.join(p_user uuid, p_group text) returns void language sql as $$
  select private.accept_invite_impl(p_user, (private.create_invite_impl('00000000-0000-0000-0000-0000000004a1', (select v from t where k = p_group), now())).token, now()) $$;
select pg_temp.join('00000000-0000-0000-0000-0000000004b1', 'fam');
select pg_temp.join('00000000-0000-0000-0000-0000000004c1', 'fam');
update public.group_members set joined_at = now() - interval '2 days' where user_id = '00000000-0000-0000-0000-0000000004b1';
update public.group_members set joined_at = now() - interval '1 day'  where user_id = '00000000-0000-0000-0000-0000000004c1';
select pg_temp.join('00000000-0000-0000-0000-0000000004d1', 'club');
update public.group_members set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000004d1';
select pg_temp.join('00000000-0000-0000-0000-0000000004e1', 'book');
update public.group_members set left_at = now() where user_id = '00000000-0000-0000-0000-0000000004e1';
insert into t select 'leo', private.create_child_impl('00000000-0000-0000-0000-0000000004a1', (select v from t where k='solo'), 'Leo', '🦁', 'peach', true);
insert into public.habits (owner_id, created_by, title, emoji, category, target_count, period, starts_on)
values ('00000000-0000-0000-0000-0000000004a1', '00000000-0000-0000-0000-0000000004a1', 'Anna reads', '📚', 'learning', 1, 'day', current_date);

-- Supabase Auth's sign-in history (auth.audit_log_entries): Anna's rows match by actor_id only, by
-- actor_username only, or by traits.user_email only (e.g. an admin action on her), emails in another case; Ben's row stays.
insert into auth.audit_log_entries (instance_id, id, payload, created_at) values
  ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), '{"action":"login","actor_id":"00000000-0000-0000-0000-0000000004a1","actor_username":"renamed@example.com","traits":{"provider":"email"}}', now()),
  ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), '{"action":"user_repeated_signup","actor_id":"00000000-0000-0000-0000-00000000ffff","actor_username":"Del-Anna@Example.com","traits":{"provider":"email"}}', now()),
  ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), '{"action":"user_invited","actor_id":"00000000-0000-0000-0000-00000000fffe","actor_username":"admin@example.com","traits":{"user_email":"DEL-ANNA@example.com"}}', now()),
  ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), '{"action":"login","actor_id":"00000000-0000-0000-0000-0000000004b1","actor_username":"del-ben@example.com","traits":{"provider":"email"}}', now());

select ok(not has_function_privilege('anon', 'public.delete_my_account()', 'execute'), 'anon cannot delete');

create temp table preview (j jsonb) on commit drop;
grant all on preview to authenticated;
select tests.authenticate_as('00000000-0000-0000-0000-0000000004a1');
insert into preview select public.delete_account_preview();
reset role;
select set_eq($$select g->>'name' from preview, jsonb_array_elements(j->'groups_deleted') g$$, array['Solo','Book'], 'preview: groups that go');
select is((select g->'children'->>0 from preview, jsonb_array_elements(j->'groups_deleted') g where g->>'name' = 'Solo'), 'Leo', 'preview: the child that goes');
select is((select h->>'new_admin' from preview, jsonb_array_elements(j->'admin_handover') h where h->>'group' = 'Family'), 'Ben', 'preview: Ben takes over Family');
select is((select jsonb_array_length(j->'admin_handover') from preview), 1, 'preview: Club keeps Dan, no handover');

-- The real call path: authenticated role, security definer deletes from auth.users.
select tests.authenticate_as('00000000-0000-0000-0000-0000000004a1');
select lives_ok($$select public.delete_my_account()$$, 'Anna deletes her account');
reset role;

select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000004a1'), 0, 'login gone');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000004a1'), 0, 'profile gone');
select is((select count(*)::int from public.habits where title = 'Anna reads'), 0, 'private habits gone');
select is((select role from public.group_members where user_id = '00000000-0000-0000-0000-0000000004b1'), 'admin', 'longest-standing member promoted');
select is((select role from public.group_members where user_id = '00000000-0000-0000-0000-0000000004c1'), 'member', 'newer member not promoted');
select is((select role from public.group_members where user_id = '00000000-0000-0000-0000-0000000004d1'), 'admin', 'other admin unchanged');
select is((select count(*)::int from public.groups where id = (select v from t where k='solo')), 0, 'empty group deleted');
select is((select count(*)::int from public.profiles where id = (select v from t where k='leo')), 0, 'its child deleted with it');
select is((select count(*)::int from public.groups where id = (select v from t where k='book')), 0, 'group with only a left member deleted');
select is((select count(*)::int from public.groups where id = (select v from t where k='fam')), 1, 'Family stays');

select is((select count(*)::int from auth.audit_log_entries
             where payload::text like '%00000000-0000-0000-0000-0000000004a1%' or payload::text ilike '%del-anna@example.com%'),
          0, 'her sign-in history gone (by id, by email, by traits email)');
select is((select count(*)::int from auth.audit_log_entries where payload->>'actor_id' = '00000000-0000-0000-0000-0000000004b1'),
          1, 'Ben''s sign-in history untouched');

select * from finish();
rollback;

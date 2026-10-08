begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- invite_preview is the one exception: the invite landing page shows the group name to signed-out
-- visitors (decision 0010).
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype <> 'trigger'::regtype
      and p.proname <> 'invite_preview'
      and has_function_privilege('anon', p.oid, 'execute')),
  0, 'anonymous visitors cannot call any public function except invite_preview');

select ok(has_function_privilege('anon', 'public.invite_preview(text)', 'execute'),
  'anonymous visitors can preview an invite');

select is(
  (select count(*)::int
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and not coalesce((select option_value = 'true'
                          from pg_options_to_table(c.reloptions)
                         where option_name = 'security_invoker'), false)),
  0, 'every public view uses security_invoker');

select ok(
  not has_schema_privilege('authenticated', 'private', 'usage')
  and not has_schema_privilege('anon', 'private', 'usage'),
  'the private schema is not reachable by API roles');

select * from finish();
rollback;

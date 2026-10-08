\set ON_ERROR_STOP on
do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array['public.profiles', 'public.habits', 'public.check_ins', 'public.groups', 'public.group_members'] loop
    execute format('select count(*) from %s', t) into n;
    if n = 0 then
      raise exception 'restore check: % is empty', t;
    end if;
    raise notice 'restore check: % has % rows', t, n;
  end loop;
end $$;

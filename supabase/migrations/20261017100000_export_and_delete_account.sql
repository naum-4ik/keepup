-- Export my data and Delete account (M6 PR 1). Spec: Privacy page and export; Groups → Deleting an account.
-- Export: everything personal, as one JSON document (GDPR right of access). Push keys are secrets of the
-- browser's push channel, not the person's data: only the device's browser and date are exported.

create function private.export_my_data_impl(p_user uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = p_user and kind = 'adult';
  if not found then
    raise exception 'keepup:not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'format', 'keepup-export-v1',
    'exported_at', now(),
    'email', (select u.email from auth.users u where u.id = p_user),
    'profile', to_jsonb(v_profile) - 'group_id' - 'kid_theme' - 'kind',
    'notification_prefs', coalesce((select jsonb_agg(to_jsonb(n) - 'user_id' order by n.category)
                                      from public.notification_prefs n where n.user_id = p_user), '[]'),
    'push_devices', coalesce((select jsonb_agg(jsonb_build_object('user_agent', s.user_agent, 'created_at', s.created_at) order by s.created_at)
                                from public.push_subscriptions s where s.user_id = p_user), '[]'),
    'private_habits', coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at)
                                  from public.habits h where h.owner_id = p_user and h.group_id is null), '[]'),
    'habit_settings', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id' order by s.habit_id)
                                  from public.habit_user_settings s where s.user_id = p_user), '[]'),
    'check_ins', coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object('habit_title', h.title) order by c.local_date, c.created_at)
                             from public.check_ins c join public.habits h on h.id = c.habit_id where c.user_id = p_user), '[]'),
    'period_results', coalesce((select jsonb_agg(to_jsonb(r) order by r.habit_id, r.period_start)
                                  from public.period_results r join public.habits h on h.id = r.habit_id
                                 where h.owner_id = p_user and h.group_id is null), '[]'),
    'pauses', coalesce((select jsonb_agg(to_jsonb(f) order by f.starts_on)
                          from public.habit_freezes f join public.habits h on h.id = f.habit_id
                         where f.user_id = p_user or (h.owner_id = p_user and h.group_id is null)), '[]'),
    'groups', coalesce((select jsonb_agg(jsonb_build_object('name', g.name, 'kind', g.kind, 'role', m.role,
                                                            'joined_at', m.joined_at, 'left_at', m.left_at) order by m.joined_at)
                          from public.group_members m join public.groups g on g.id = m.group_id where m.user_id = p_user), '[]'),
    'group_habits', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'group', g.name, 'title', h.title, 'emoji', h.emoji,
                                                                  'period', h.period, 'target_count', h.target_count, 'starts_on', h.starts_on) order by h.created_at)
                                from public.group_habit_participants p join public.habits h on h.id = p.habit_id
                                join public.groups g on g.id = h.group_id where p.profile_id = p_user), '[]'),
    'xp_events', coalesce((select jsonb_agg(to_jsonb(e) - 'user_id' order by e.created_at) from public.xp_events e where e.user_id = p_user), '[]'),
    'level_ups', coalesce((select jsonb_agg(to_jsonb(l) - 'user_id' order by l.level) from public.level_ups l where l.user_id = p_user), '[]'),
    'badges', coalesce((select jsonb_agg(to_jsonb(a) - 'user_id' order by a.unlocked_at) from public.user_achievements a where a.user_id = p_user), '[]'),
    'inbox', coalesce((select jsonb_agg(to_jsonb(n) - 'user_id' order by n.created_at) from public.notifications n where n.user_id = p_user), '[]'),
    'cheers_given', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.created_at) from public.cheers c where c.user_id = p_user), '[]'),
    'nudges_sent', coalesce((select jsonb_agg(to_jsonb(n) - 'sender_id' order by n.created_at) from public.nudges n where n.sender_id = p_user), '[]'),
    'children', coalesce((select jsonb_agg(private.export_child_impl(p_user, c.id) order by c.created_at)
                            from public.profiles c join public.group_members m on m.group_id = c.group_id
                           where c.kind = 'child' and m.user_id = p_user and m.left_at is null and m.role = 'admin'), '[]')
  );
end;
$$;

create function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'keepup:not_authenticated' using errcode = '42501';
  end if;
  return private.export_my_data_impl(auth.uid());
end;
$$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- Delete account. One transaction: hand over admin, delete groups left empty (children and group habits
-- go with them), then delete the login; the on_auth_user_deleted trigger deletes the profile and every
-- personal row cascades. "Others" are active members (left_at is null) other than the person.
-- Concurrency: the groups are locked FOR UPDATE in id order before counting, so two last admins
-- deleting at the same moment run one after the other and the second sees the first's handover.

create function private.delete_account_plan(p_user uuid)
returns table (group_id uuid, group_name text, action text, new_admin uuid)
language sql
stable
set search_path = ''
as $$
  select g.id, g.name,
         case when o.others = 0 then 'delete'
              when m.role = 'admin' and o.other_admins = 0 then 'handover'
              else 'leave' end,
         case when o.others > 0 and m.role = 'admin' and o.other_admins = 0 then
           (select x.user_id from public.group_members x
             where x.group_id = g.id and x.user_id <> p_user and x.left_at is null
             order by x.joined_at, x.user_id limit 1) end
    from public.group_members m
    join public.groups g on g.id = m.group_id
    cross join lateral (
      select count(*) filter (where x.user_id <> p_user) as others,
             count(*) filter (where x.user_id <> p_user and x.role = 'admin') as other_admins
        from public.group_members x where x.group_id = g.id and x.left_at is null) o
   where m.user_id = p_user and m.left_at is null
$$;

create function private.delete_account_preview_impl(p_user uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'groups_deleted', coalesce((select jsonb_agg(jsonb_build_object('name', p.group_name,
        'children', coalesce((select jsonb_agg(c.display_name order by c.created_at) from public.profiles c
                               where c.kind = 'child' and c.group_id = p.group_id), '[]')) order by p.group_name)
      from private.delete_account_plan(p_user) p where p.action = 'delete'), '[]'),
    'admin_handover', coalesce((select jsonb_agg(jsonb_build_object('group', p.group_name,
        'new_admin', (select a.display_name from public.profiles a where a.id = p.new_admin)) order by p.group_name)
      from private.delete_account_plan(p_user) p where p.action = 'handover'), '[]'))
$$;

create function private.delete_account_impl(p_user uuid, p_now timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r record;
begin
  if not exists (select 1 from public.profiles where id = p_user and kind = 'adult') then
    raise exception 'keepup:not_found' using errcode = 'P0002';
  end if;
  perform 1 from public.groups g
    where g.id in (select m.group_id from public.group_members m where m.user_id = p_user and m.left_at is null)
    order by g.id for update;
  for r in select * from private.delete_account_plan(p_user) order by group_id loop
    if r.action = 'delete' then
      delete from public.groups where id = r.group_id;
    elsif r.action = 'handover' then
      update public.group_members set role = 'admin' where group_id = r.group_id and user_id = r.new_admin;
    end if;
  end loop;
  delete from auth.users where id = p_user;
end;
$$;

create function public.delete_account_preview()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  return private.delete_account_preview_impl(auth.uid());
end; $$;

create function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.delete_account_impl(auth.uid(), now());
end; $$;

revoke execute on function public.delete_account_preview(), public.delete_my_account() from public, anon;
grant execute on function public.delete_account_preview(), public.delete_my_account() to authenticated;

-- Languages (plans/2026-10-15-keepup-languages.md). null locale = not chosen yet: the app uses the
-- phone's language and saves it on first visit. gender is for kids only (gendered ru/he kid copy).
alter table public.profiles
  add column locale text check (locale in ('en', 'ru', 'he')),
  add column gender text check (gender in ('boy', 'girl'));

grant update (locale) on public.profiles to authenticated;

create function private.set_child_gender_impl(p_actor uuid, p_child_id uuid, p_gender text)
returns void language plpgsql set search_path = '' as $$
begin
  perform private.require_guardian(p_actor, p_child_id);
  if p_gender is not null and p_gender not in ('boy', 'girl') then
    raise exception 'keepup:invalid_gender' using errcode = '22023';
  end if;
  update public.profiles set gender = p_gender where id = p_child_id and kind = 'child';
end;
$$;

create function public.set_child_gender(p_child_id uuid, p_gender text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.set_child_gender_impl(auth.uid(), p_child_id, p_gender);
end;
$$;
revoke execute on function private.set_child_gender_impl(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.set_child_gender(uuid, text) from public, anon;
grant execute on function public.set_child_gender(uuid, text) to authenticated;
-- Copied from 20261005100000_group_pushes.sql; adds locale (recipient) and subject_gender.
create or replace function private.push_job_build(p_id uuid, p_now timestamptz default now())
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'user_id', n.user_id, 'pushed', n.pushed_at is not null,
    'group_id', n.group_id, 'group', g.name, 'habit_id', n.habit_id, 'habit', h.title, 'period', h.period,
    'target', h.target_count, 'check_in_id', n.check_in_id, 'check_in_status', c.status,
    'actor', a.display_name, 'subject_id', n.subject_id, 'subject', s.display_name, 'payload', n.payload,
    'silent', coalesce(np.delivery, 'silent') <> 'sound',
    'locale', coalesce(r.locale, 'en'),
    'subject_gender', s.gender,
    'names', case when n.kind = 'group_check_in' then (
      select coalesce(jsonb_agg(x.name order by x.first), '[]'::jsonb)
        from (select ap.display_name as name, min(o.created_at) as first
                from public.notifications o
                join public.check_ins oc on oc.id = o.check_in_id
                join public.profiles ap on ap.id = o.actor_id
               where o.user_id = n.user_id and o.kind = 'group_check_in' and o.habit_id = n.habit_id
                 and oc.local_date = c.local_date
               group by ap.id, ap.display_name) x)
      else '[]'::jsonb end,
    'pending', case when n.kind in ('approval_needed', 'approval_expiring') then (
      select coalesce(jsonb_agg(jsonb_build_object('check_in_id', pa.check_in_id, 'author', pa.author_name, 'habit', pa.habit_title)
                                order by pa.created_at), '[]'::jsonb)
        from private.pending_approvals_impl(n.user_id, p_now) pa)
      else '[]'::jsonb end,
    'subscriptions', (
      select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth)), '[]'::jsonb)
        from public.push_subscriptions ps where ps.user_id = n.user_id))
    from public.notifications n
    left join public.groups g on g.id = n.group_id
    left join public.habits h on h.id = n.habit_id
    left join public.check_ins c on c.id = n.check_in_id
    left join public.profiles a on a.id = n.actor_id
    left join public.profiles s on s.id = n.subject_id
    left join public.profiles r on r.id = n.user_id
    left join public.notification_prefs np on np.user_id = n.user_id and np.category = private.push_category(n.kind)
   where n.id = p_id and n.push;
$$;
revoke execute on function private.push_job_build(uuid, timestamptz) from public, anon, authenticated;

-- Copied from 20261009110000_polish.sql; the export also carries the child's gender.
create or replace function private.export_child_impl(p_actor uuid, p_child_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  perform private.require_guardian(p_actor, p_child_id);
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select jsonb_build_object('name', c.display_name, 'avatar_emoji', c.avatar_emoji,
                                          'avatar_color', c.avatar_color, 'gender', c.gender, 'created_at', c.created_at)
                  from public.profiles c where c.id = p_child_id),
    'habits', coalesce((select jsonb_agg(jsonb_build_object(
                  'title', h.title, 'emoji', h.emoji, 'target_count', h.target_count, 'period', h.period,
                  'starts_on', h.starts_on, 'archived_at', h.archived_at) order by h.created_at)
                from public.habits h where h.owner_id = p_child_id), '[]'::jsonb),
    'check_ins', coalesce((select jsonb_agg(jsonb_build_object(
                  'habit', h.title, 'local_date', c.local_date, 'status', c.status,
                  'by_child', c.by_child, 'created_at', c.created_at) order by c.created_at)
                from public.check_ins c join public.habits h on h.id = c.habit_id
               where c.user_id = p_child_id), '[]'::jsonb),
    'treat_goals', coalesce((select jsonb_agg(jsonb_build_object(
                  'title', g.title, 'emoji', g.emoji, 'target', g.target, 'created_at', g.created_at,
                  'reached_at', g.reached_at, 'received_at', g.received_at) order by g.created_at)
                from public.treat_goals g where g.child_id = p_child_id), '[]'::jsonb));
end;
$$;

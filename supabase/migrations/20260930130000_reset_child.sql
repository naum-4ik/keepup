-- Reset a child's profile (ideas/kid-view-next.md §3): a fresh start that keeps only the nickname and
-- the avatar. Admins only, like deleting a child; the app offers Export first.
--
-- Cleared: her own habits (with their check-ins, results and pauses, by cascade), her check-ins and
-- member pauses on group habits, her place in group habits, treat goals, the feed about her, and
-- nudges to her. Stars and the garden album are computed from check-ins, so they start over too.
-- Group habits themselves and the adults' data are untouched; finished periods keep their results.
create function private.reset_child_impl(p_actor uuid, p_child_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.require_admin(private.require_guardian(p_actor, p_child_id), p_actor);
  delete from public.habits where owner_id = p_child_id;
  delete from public.check_ins where user_id = p_child_id;
  delete from public.habit_freezes where user_id = p_child_id;
  delete from public.group_habit_participants where profile_id = p_child_id;
  delete from public.treat_goals where child_id = p_child_id;
  delete from public.notifications where subject_id = p_child_id or user_id = p_child_id;
  delete from public.nudges where recipient_id = p_child_id;
end;
$$;

create function public.reset_child(p_child_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.reset_child_impl(auth.uid(), p_child_id);
end;
$$;

revoke execute on function public.reset_child(uuid) from public, anon;
grant execute on function public.reset_child(uuid) to authenticated;

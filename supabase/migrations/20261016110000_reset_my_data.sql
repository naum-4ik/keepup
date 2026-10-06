-- Reset my data (owner 2026-10-06, CONTEXT "Decisions from chat"): Settings → "Reset my data", typed
-- "reset" to confirm. A fresh start for the person, without losing the account or the family.
--
-- Cleared (the caller's own):
--   - private habits (owner_id = me, no group) with their check-ins, period_results, pauses, per-habit
--     settings and their Inbox rows and nudges (all by the habits' cascades);
--   - the XP ledger, level-ups (so the level badge and the level moment start again), badges;
--   - the Inbox (every notification row of mine, recaps and history included) and dismissed cards.
-- Kept:
--   - the account, profile fields, settings (time zone, week start, celebrations), notification
--     prefs, push devices;
--   - groups, memberships, children (and all their data: they have Reset child), group habits;
--   - my check-ins, pauses and per-habit settings in group habits: they are the group's history
--     (controller ruling), so the group's results and streaks don't change. My XP from them is cleared
--     with the rest of the ledger; new check-ins earn again from zero;
--   - cheers I gave and nudges I sent or got on group habits (the other person's history);
--   - recap_runs: they only mark a recap as already sent (no content, purged after 62 days). Deleting
--     them would make the next cron tick send this week's recap again.
-- Idempotent: a second call finds nothing left to clear.
--
-- Locks: habit → check-in → period_results → per-habit rows → per-person rows. The private habits are
-- locked first, in id order (FOR UPDATE, as finalize_periods does), so a finalize or a check-in on one
-- of them either finishes before the reset or waits and then finds the habit gone. Their check-ins,
-- results and per-habit rows go with the habits (cascades; the check-in delete triggers see the habit
-- gone and grant nothing). Then this person's rows: ledger, levels, badges, Inbox, dismissed cards.
-- No other person's rows are written.

create function private.reset_my_data_impl(p_user uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = p_user and p.kind = 'adult') then
    raise exception 'keepup:not_found' using errcode = 'P0002';
  end if;
  perform 1 from public.habits h where h.owner_id = p_user and h.group_id is null order by h.id for update;
  delete from public.habits h where h.owner_id = p_user and h.group_id is null;
  delete from public.xp_events x where x.user_id = p_user;
  delete from public.level_ups l where l.user_id = p_user;
  delete from public.user_achievements a where a.user_id = p_user;
  delete from public.notifications n where n.user_id = p_user;
  delete from public.dismissed_cards d where d.user_id = p_user;
end;
$$;

create function public.reset_my_data()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'keepup:not_authenticated' using errcode = '42501'; end if;
  perform private.reset_my_data_impl(auth.uid());
end;
$$;

revoke execute on function public.reset_my_data() from public, anon;
grant execute on function public.reset_my_data() to authenticated;

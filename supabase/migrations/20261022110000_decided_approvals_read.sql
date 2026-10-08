-- Production deep test (2026-10-08), N1 (owner ruling): once a pending check-in is approved, not
-- approved or expires, its "Approve?" rows (approval_needed, and approval_expiring) read the outcome
-- and count as read for every reviewer, so the bell stops counting them. The rows stay in the feed
-- as history (the 60-day purge goes by created_at). Only that check-in's rows change. The outcome
-- goes into the row's payload, so the Inbox renders it without a new column.
-- Idempotent: or replace, if not exists.

create index if not exists notifications_check_in_idx on public.notifications (check_in_id) where check_in_id is not null;

-- p_check_in null = every decided check-in (the one-time backfill below).
create or replace function private.mark_decided_approvals_read(p_check_in uuid)
returns void
language sql
set search_path = ''
as $$
  update public.notifications n
     set read_at = coalesce(n.read_at, now()),
         payload = n.payload || jsonb_build_object('outcome', c.status)
    from public.check_ins c
   where c.id = n.check_in_id
     and (p_check_in is null or n.check_in_id = p_check_in)
     and n.kind in ('approval_needed', 'approval_expiring')
     and c.status <> 'pending'
     and (n.read_at is null or n.payload->>'outcome' is distinct from c.status);
$$;
revoke execute on function private.mark_decided_approvals_read(uuid) from public, anon, authenticated;

create or replace function private.feed_on_approval_decided()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status <> 'pending' then
    perform private.mark_decided_approvals_read(new.id);
  end if;
  return new;
end;
$$;
revoke execute on function private.feed_on_approval_decided() from public, anon, authenticated;

drop trigger if exists check_ins_approval_decided on public.check_ins;
create trigger check_ins_approval_decided after update of status on public.check_ins
  for each row execute function private.feed_on_approval_decided();

select private.mark_decided_approvals_read(null);

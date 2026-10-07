-- supabase/tests/database/deferred_queue_commit.test.sql
-- The deferred-work queue (pg_temp.keepup_deferred, 20261016100000) is per transaction: what one
-- transaction queues and commits is gone in the next one on the same connection (ON COMMIT DELETE
-- ROWS). No begin/rollback here on purpose: each statement below is its own committed transaction.
-- It writes nothing outside this session's temp table.
create extension if not exists pgtap with schema extensions;
select plan(3);

select is((select count(*)::int from (select private.queue_add('level', '00000000-0000-0000-0000-0000000004a1', '', null, false, false)) a,
                                       lateral private.queue_list('level') q),
  1, 'inside its transaction, a queued entry is there');
select is((select count(*)::int from private.queue_list('level')), 0, 'the next transaction, after the commit, finds the queue empty');
select ok(to_regclass('pg_temp.keepup_deferred') is not null, 'the table itself stays for the session (created once)');

select * from finish();

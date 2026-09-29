begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

select is(private.period_start('week', '2026-10-04'), '2026-09-28'::date, 'Monday weeks: a Sunday belongs to the week starting Monday');
select is(private.period_start('week', '2026-09-28'), '2026-09-28'::date, 'Monday weeks: a Monday starts its own week');
select is(private.period_start('week', '2026-10-04', 0::smallint), '2026-10-04'::date, 'Sunday weeks: a Sunday starts its own week');
select is(private.period_start('week', '2026-10-03', 0::smallint), '2026-09-27'::date, 'Sunday weeks: a Saturday belongs to the week starting Sunday');
select is(private.period_start('month', '2026-10-31'), '2026-10-01'::date, 'months start on the 1st');
select is(private.period_start('day', '2026-10-31'), '2026-10-31'::date, 'a day is its own period');
select is(private.period_end('week', '2026-09-28'), '2026-10-05'::date, 'a week ends 7 days later (exclusive)');
select is(private.period_end('month', '2026-02-01'), '2026-03-01'::date, 'February ends on 1 March');
select is(private.period_step('month'), interval '1 month', 'month step');

select is(private.local_date('2026-10-25 22:30:00+00', 'Europe/Rome'), '2026-10-25'::date,
  '22:30 UTC after the October DST change is still 25 Oct in Rome');
select is(private.local_date('2026-06-30 22:30:00+00', 'Europe/Rome'), '2026-07-01'::date,
  '22:30 UTC in summer is already the next day in Rome');
select is(private.local_midnight('2026-10-26', 'Europe/Rome') - private.local_midnight('2026-10-25', 'Europe/Rome'),
  interval '25 hours', '25 Oct 2026 lasts 25 hours in Rome');
select is(private.local_midnight('2026-03-30', 'Europe/Rome') - private.local_midnight('2026-03-29', 'Europe/Rome'),
  interval '23 hours', '29 Mar 2026 lasts 23 hours in Rome');
select is(private.local_midnight('2026-10-26', 'Asia/Jerusalem'), '2026-10-25 22:00:00+00'::timestamptz,
  'Jerusalem midnight after its DST change is 22:00 UTC');

select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'week@example.com');
select is((select week_start from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'), 1::smallint,
  'weeks start on Monday by default');
select tests.authenticate_as('00000000-0000-0000-0000-0000000000c1');
select lives_ok($$update public.profiles set week_start = 0 where id = '00000000-0000-0000-0000-0000000000c1'$$,
  'a user can switch to Sunday weeks');
select throws_ok($$update public.profiles set week_start = 3 where id = '00000000-0000-0000-0000-0000000000c1'$$,
  '23514', null, 'weeks can only start on Sunday or Monday');
reset role;

select * from finish();
rollback;

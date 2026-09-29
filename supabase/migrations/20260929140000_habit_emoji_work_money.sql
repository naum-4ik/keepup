-- New-habit menu v2: an emoji per habit, and "Money" becomes "Work & money".
-- Nothing in a function, view or policy hard-codes 'money', so renaming the enum value is safe.
alter type public.habit_category rename value 'money' to 'work_money';

-- The emoji shown when a habit has none of its own (lib/categories.ts keeps the same table).
create function private.default_emoji(p_category public.habit_category)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'health' then '🍎'
    when 'fitness' then '👟'
    when 'mind' then '🌿'
    when 'learning' then '📚'
    when 'people' then '💛'
    when 'home' then '🏠'
    when 'work_money' then '💼'
    when 'break_habit' then '🚫'
  end;
$$;

-- Backfill rule for habits created before emoji existed: a title that exactly matches a template
-- (lib/habit-templates.ts) gets that template's emoji, anything else the category default.
create function private.backfill_emoji(p_title text, p_category public.habit_category)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select t.emoji from (values
    ('Drink water', '💧'),
    ('Sleep by 23:00', '😴'),
    ('Take vitamins or meds', '💊'),
    ('Eat fruit or vegetables', '🥗'),
    ('Floss', '🦷'),
    ('Wake up at 07:00', '⏰'),
    ('Walk 10,000 steps', '👟'),
    ('Work out', '🏋️'),
    ('Stretch', '🤸'),
    ('Run', '🏃'),
    ('Yoga', '🧘‍♀️'),
    ('Swim or cycle', '🏊'),
    ('Meditate', '🧘'),
    ('Journal', '📓'),
    ('Gratitude: write 3 things', '✨'),
    ('No phone in bed', '📵'),
    ('Time outside', '🌳'),
    ('Pray', '🙏'),
    ('Read 20 min', '📚'),
    ('Learn a language', '🗣️'),
    ('Practice an instrument', '🎸'),
    ('Podcast or course', '🎧'),
    ('Study', '🎓'),
    ('Write', '✍️'),
    ('Call family or a friend', '📞'),
    ('Message someone you miss', '💌'),
    ('Phone-free time with the kids', '🧸'),
    ('Date night', '🕯️'),
    ('Do something kind', '🤝'),
    ('Screen-free dinner', '🍽️'),
    ('Tidy up', '🧹'),
    ('Make the bed', '🛏️'),
    ('Cook at home', '🍳'),
    ('Water the plants', '🪴'),
    ('Laundry', '🧺'),
    ('Clean the kitchen', '🧽'),
    ('Plan tomorrow', '📝'),
    ('Deep-work block', '🎯'),
    ('No work email after 19:00', '🌙'),
    ('No-spend day', '💸'),
    ('Log expenses', '🧾'),
    ('Weekly budget check', '📊'),
    ('No sugar', '🍬'),
    ('No alcohol', '🍷'),
    ('No social media before noon', '📱'),
    ('No smoking', '🚭'),
    ('No snacking after dinner', '🍪'),
    ('No caffeine after 14:00', '☕')
    ) as t(title, emoji) where t.title = p_title),
    private.default_emoji(p_category));
$$;

alter table public.habits add column emoji text;
update public.habits set emoji = private.backfill_emoji(title, category);
alter table public.habits alter column emoji set not null;
-- One emoji is one grapheme, checked by the app (Intl.Segmenter); the database only bounds it.
alter table public.habits add constraint habits_emoji_check check (char_length(emoji) between 1 and 16 and btrim(emoji) <> '');

grant insert (emoji) on public.habits to authenticated;
grant update (emoji) on public.habits to authenticated;

-- Same as 20260929100500, plus: an insert without an emoji gets the category default, so older
-- clients (and anything that doesn't send one) keep working.
create or replace function private.habit_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date;
begin
  select private.local_date(now(), p.timezone) into v_today
    from public.profiles p where p.id = new.owner_id;

  if tg_op = 'INSERT' then
    new.starts_on := coalesce(new.starts_on, v_today);
    new.week_start := (select p.week_start from public.profiles p where p.id = new.owner_id);
    new.emoji := coalesce(nullif(btrim(new.emoji), ''), private.default_emoji(new.category));
  end if;

  if tg_op = 'INSERT' or new.starts_on is distinct from old.starts_on then
    if tg_op = 'UPDATE' and exists (select 1 from public.check_ins c where c.habit_id = new.id) then
      raise exception 'keepup:start_locked' using errcode = 'P0001';
    end if;
    if new.starts_on < v_today then
      raise exception 'keepup:start_in_past' using errcode = 'P0001';
    end if;
    if new.starts_on > v_today + 365 then
      raise exception 'keepup:start_too_far' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.archived_at is distinct from old.archived_at then
    new.archived_at := coalesce(old.archived_at, now());
  end if;
  return new;
end;
$$;

-- habit_summaries gains the emoji. The return type changes, so both functions are recreated
-- (body otherwise as in 20260929120000) and the grants re-applied.
drop function public.habit_summaries();
drop function private.habit_summaries(uuid, timestamptz);

create function private.habit_summaries(p_user_id uuid, p_now timestamptz)
returns table (
  habit_id uuid, title text, category public.habit_category, emoji text, target_count smallint,
  period public.habit_period, starts_on date, created_at timestamptz, archived_at timestamptz,
  period_start date, not_started boolean, done_count int, checked_in_today boolean, frozen boolean,
  frozen_until date, days_left int, current_streak int, best_streak int)
language sql
stable
set search_path = ''
as $$
  select h.id, h.title, h.category, h.emoji, h.target_count, h.period, h.starts_on, h.created_at, h.archived_at,
         cur.start,
         ctx.today < h.starts_on,
         (select count(*)::int from public.check_ins c
           where c.habit_id = h.id and c.period_start = cur.start and c.status = 'approved'),
         exists (select 1 from public.check_ins c
                  where c.habit_id = h.id and c.local_date = ctx.today and c.status <> 'rejected'),
         private.is_frozen(h.id, ctx.today, ctx.today + 1),
         (select f.ends_on from public.habit_freezes f
           where f.habit_id = h.id and f.starts_on <= ctx.today
             and coalesce(f.ends_on, 'infinity'::date) >= ctx.today
           limit 1),
         (cur.finish - ctx.today),
         st.current_streak, st.best_streak
    from public.habits h
    cross join lateral (select private.habit_today(h, p_now) as today) ctx
    cross join lateral (select private.habit_period_start(h, ctx.today) as start) s0
    cross join lateral (select s0.start, private.period_end(h.period, s0.start) as finish) cur
    cross join lateral private.habit_streaks(h.id, p_now) st
   where h.owner_id = p_user_id
   order by h.archived_at nulls first, h.created_at;
$$;

create function public.habit_summaries()
returns table (
  habit_id uuid, title text, category public.habit_category, emoji text, target_count smallint,
  period public.habit_period, starts_on date, created_at timestamptz, archived_at timestamptz,
  period_start date, not_started boolean, done_count int, checked_in_today boolean, frozen boolean,
  frozen_until date, days_left int, current_streak int, best_streak int)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.habit_summaries(auth.uid(), now());
$$;

revoke execute on function public.habit_summaries() from public, anon;
grant execute on function public.habit_summaries() to authenticated;
